import psutil
import time
import threading
from utils.config import base_event

class USBMonitor:
    
    def __init__(self, event_callback, interval=5, stop_event=None):
        self.event_callback = event_callback
        self.interval = interval
        self.stop_event = stop_event or threading.Event()
        self.thread = None
        self.previous_devices = self._get_removable_devices()
        self._usage_at_insert: dict[str, int] = {}

    def _get_removable_devices(self):
        devices = set()
        for partition in psutil.disk_partitions(all=False):
            if 'removable' in partition.opts.lower():
                devices.add(partition.mountpoint)
        return devices
    
    def _get_used_bytes(self, mountpoint) -> int | None:
        try:
            return psutil.disk_usage(mountpoint).used
        except Exception:
            return None
        
    def start(self):
        self.thread = threading.Thread(target=self._monitor_loop, name="usb-monitor", daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        if self.thread is not None:
            self.thread.join(timeout=self.interval + 1)

    def _monitor_loop(self):
        while not self.stop_event.is_set():
            current_devices = self._get_removable_devices()
            inserted = current_devices - self.previous_devices
            removed = self.previous_devices - current_devices

            for device in inserted:
                usage = self._get_used_bytes(device)
                self._usage_at_insert[device] = usage if usage is not None else 0

                event = base_event("usb_inserted")
                event["metadata"] = {
                    "mountpoint": device,
                    "used_bytes_at_insert": usage,
                }
                self.event_callback(event)

            for device in removed:
                baseline = self._usage_at_insert.pop(device, None)
                last_known = self._last_known_usage.get(device)

                write_delta_bytes = None
                if baseline is not None and last_known is not None:
                    delta = last_known - baseline
                    write_delta_bytes = max(delta, 0)

                event = base_event("usb_removed")
                event["metadata"] = {
                    "mountpoint": device,
                    "write_delta_bytes": write_delta_bytes,
                    "write_delta_mb": round(write_delta_bytes / (1024 * 1024), 2) if write_delta_bytes is not None else None
                }
                self.event_callback(event)
            
            self._last_known_usage = {}
            for device in current_devices:
                usage = self._get_used_bytes(device)
                if usage is not None:
                    self._last_known_usage[device] = usage
                    
            self.previous_devices = current_devices
            self.stop_event.wait(self.interval)
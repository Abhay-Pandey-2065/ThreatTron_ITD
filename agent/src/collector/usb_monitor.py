import psutil
import time
import threading
from utils.config import base_event

class USBMonitor:
    
    def __init__(self, event_callback, interval=5):
        self.event_callback = event_callback
        self.interval = interval
        self.previous_devices = self._get_removable_devices()

    def _get_removable_devices(self):
        devices = []
        for partition in psutil.disk_partitions(all=False):
            if 'removable' in partition.opts.lower():
                devices.append(partition.mountpoint)
        return set(devices)
        
    def start(self):
        thread = threading.Thread(target=self._monitor_loop)
        thread.daemon = True
        thread.start()

    def _monitor_loop(self):
        while True:
            current_devices = self._get_removable_devices()
            inserted = current_devices - self.previous_devices
            removed = self.previous_devices - current_devices

            for device in inserted:
                event = base_event("usb_inserted")
                event["metadata"] = {"mountpoint": device}
                self.event_callback(event)

            for device in removed:
                event = base_event("usb_removed")
                event["metadata"] = {"mountpoint": device}
                self.event_callback(event)
                
            self.previous_devices = current_devices
            time.sleep(self.interval)
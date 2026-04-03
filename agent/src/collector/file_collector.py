import os
import psutil
import time
import threading
import struct
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from utils.config import base_event
from utils.config import MONITORED_DIRECTORIES

IGNORED_PATHS = [".git", "__pycache__", "node_modules", ".venv", "AppData", "Temp"]

class CorporateFileHandler(FileSystemEventHandler):

    def __init__(self, event_callback):
        self.event_callback = event_callback
        self.start_time = time.time()
        self.last_events = {}
        self.recent_deletes = {}
        self.suppress_modifications = {}
        self._lock = threading.Lock()

    def on_created(self, event):
        if self.should_ignore(event.src_path) or "ThreatTron_ITD" in event.src_path:
            return
        
        now = time.time()
        matched_path = None

        for path, entry in list(self.recent_deletes.items()):
            delete_time = entry["time"] if isinstance(entry, dict) else entry

            if now - delete_time > 3:
                del self.recent_deletes[path]
                continue

            same_name = os.path.basename(path) == os.path.basename(event.src_path)
            if not same_name:
                continue

            src_dir = os.path.dirname(path)
            dest_dir = os.path.dirname(event.src_path)

            if src_dir == dest_dir: 
                event_data = base_event("file_renamed")
                event_data["metadata"] = {
                    "action": "renamed",
                    "old_name": os.path.basename(path),
                    "new_name": os.path.basename(event.src_path),
                    "directory": src_dir,
                    "is_directory": event.is_directory
                }
            else:
                event_data = base_event("file_moved")
                event_data["metadata"] = {
                    "action": "moved",
                    "source_path": path,
                    "destination_path": event.src_path,
                    "is_directory": event.is_directory,
                    "external_transfer": self.is_external_drive(event.src_path),
                    "moved_outside_scope": self.is_outside_monitored_scope(event.src_path)
                }
            matched_path = path
            self.event_callback(event_data)
            break
        if matched_path:
            del self.recent_deletes[matched_path]
        else:
            self._handle_event(event, "created")

    def on_moved(self, event):
        if self.should_ignore(event.src_path) or self.should_ignore(event.dest_path):
            return
        
        src = event.src_path
        dest = event.dest_path
        src_dir = os.path.dirname(src)
        dest_dir = os.path.dirname(dest)
        
        suppress_time = time.time()
        with self._lock:
            for path in [src, dest, src_dir, dest_dir]:
                self.suppress_modifications[path] = suppress_time

        if src_dir == dest_dir:
            event_data = base_event("file_renamed")
            event_data["metadata"] = {
                "action": "renamed",
                "old_name": os.path.basename(src),
                "new_name": os.path.basename(dest),
                "directory": src_dir,
                "is_directory": event.is_directory
            }
        else:
            event_data = base_event("file_moved")
            event_data["metadata"] = {
                "action": "moved",
                "source_path": src,
                "destination_path": dest,
                "is_directory": event.is_directory,
                "external_transfer": self.is_external_drive(dest),
                "moved_outside_scope": self.is_outside_monitored_scope(dest)
            }
        self.event_callback(event_data)

    def on_modified(self, event):
        threading.Timer(0.2, self._delayed_modified, args=[event]).start()

    def on_deleted(self, event):
        if self.should_ignore(event.src_path) or "ThreatTron_ITD" in event.src_path:
            return
        
        now = time.time()
        size_at_delete = None
        try:
            if os.path.exists(event.src_path):
                size_at_delete = os.path.getsize(event.src_path)
        except Exception:
            pass

        self.recent_deletes[event.src_path] = {
            "time": now,
            "is_directory": event.is_directory,
            "size": size_at_delete
        }
        threading.Timer(0.5, self._deferred_delete, args=[event.src_path, event.is_directory, now]).start()

    def _delayed_modified(self, event):
        self._handle_event(event, "modified")

    def _deferred_delete(self, path, is_directory, delete_time):
        if path not in self.recent_deletes:
            return
        entry = self.recent_deletes[path]
        stored_time = entry["time"] if isinstance(entry, dict) else entry

        if time.time() - stored_time > 3:
            del self.recent_deletes[path]
            return
        
        del self.recent_deletes[path]
        action = "deleted"
        moved_outside = False

        if not is_directory:
            filename = os.path.basename(path)
            expected_size = entry.get("size") if isinstance(entry, dict) else None

            in_recycle_bin = self._is_in_recycle_bin(filename, expected_size, max_age_seconds=5)

            if in_recycle_bin:
                action = "deleted"
                moved_outside = False
            else:
                action = "moved_outside_scope"
                moved_outside = True

        event_data = base_event("file_activity")
        event_data["metadata"] = {
            "file_path": path,
            "action": action,
            "is_directory": is_directory,
            "file_size": None,
            "moved_outside_scope": moved_outside
        }
        self.event_callback(event_data)

    def _is_in_recycle_bin(self, filename, expected_size=None, max_age_seconds=5):
        now_filetime = int((time.time() + 11644473600) * 10000000)

        for partition in psutil.disk_partitions(all=False):
            recycle_paths = [
                os.path.join(partition.mountpoint, "$Recycle.Bin"),
                os.path.join(partition.mountpoint, "RECYCLER"),
            ]
            for recycle_path in recycle_paths:
                if not os.path.exists(recycle_path):
                    continue
                try:
                    for user_dir in os.scandir(recycle_path):
                        if not user_dir.is_dir():
                            continue
                        for item in os.scandir(user_dir.path):
                            if not item.name.startswith("$I"):
                                continue
                            result = self._read_recycle_bin_metadata(item.path)
                            if result is None:
                                continue
                            original_name, deleted_filetime = result
                            if os.path.basename(original_name) != filename:
                                continue
                            ago_seconds = (now_filetime - deleted_filetime) / 10000000
                            if 0 <= ago_seconds <= max_age_seconds:
                                return True
                except (PermissionError, OSError):
                    continue
        return False
    
    def _read_recycle_bin_metadata(self, i_file_path):
        try:
            with open(i_file_path, "rb") as f:
                data = f.read()
            if len(data) < 28:
                return None
            deleted_filetime = struct.unpack("<q", data, 16)[0]
            original_path = data[28:].decode("utf-16-le").rstrip("\x00")
            return original_path, deleted_filetime
        except Exception:
            return None

    def is_outside_monitored_scope(self, path):
        path = os.path.abspath(path).lower()
        monitored = [os.path.abspath(d).lower() for d in MONITORED_DIRECTORIES]
        return not any(path.startswith(d) for d in monitored)

    def is_external_drive(self, path):
        for partition in psutil.disk_partitions(all=False):
            if "removable" in partition.opts.lower():
                if path.startswith(partition.mountpoint):
                    return True
        return False
    
    def should_ignore(self, path):
        return any(ignore.lower() in path.lower() for ignore in IGNORED_PATHS)
    
    def suppress_path(self, path):
        now = time.time()
        with self._lock:
            self.suppress_modifications[path] = now
            self.suppress_modifications[os.path.dirname(path)] = now

    def _handle_event(self, event, action):
        if time.time() - self.start_time < 3:
            return
        if self.should_ignore(event.src_path) or "ThreatTron_ITD" in event.src_path:
            return
        
        now = time.time()
        with self._lock:
            self.suppress_modifications = {
                p: t for p, t in self.suppress_modifications.items()
                if now - t < 5
            }
            if action in ("modified", "deleted"):
                for path, t in self.suppress_modifications.items():
                    if now - t > 5:
                        continue
                    if (event.src_path == path or event.src_path.startswith(path + os.sep) or path.startswith(event.src_path + os.sep)):
                        return

        key = (event.src_path, action)
        if key in self.last_events and now - self.last_events[key] < 2:
            return
        self.last_events[key] = now

        size = None
        if not event.is_directory:
            try:
                if os.path.exists(event.src_path):
                    size = os.path.getsize(event.src_path)
            except Exception:
                pass
        
        event_data = base_event("file_activity")
        event_data["metadata"] = {
            "file_path": event.src_path,
            "action": action,
            "is_directory": event.is_directory,
            "file_size": size
        }
        self.event_callback(event_data)

class FileMonitor:

    def __init__(self, directories, event_callback):
        self.observer = Observer()
        self.directories = directories
        self.event_callback = event_callback

    def start(self):
        handler = CorporateFileHandler(self.event_callback)
        for directory in self.directories:
            self.observer.schedule(handler, directory, recursive=True)
        self.observer.start()
        thread = threading.Thread(target=self._keep_alive, daemon=True)
        thread.start()
    
    def _keep_alive(self):
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.observer.stop()
        self.observer.join()
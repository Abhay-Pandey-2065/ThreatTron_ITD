import os
import psutil
import time
# import hashlib
import threading
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
        for path, delete_time in list(self.recent_deletes.items()):
            if now - delete_time > 3:
                del self.recent_deletes[path]
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
                "source_path": src,
                "destination_path": dest,
                "is_directory": event.is_directory,
                "external_transfer": self.is_external_drive(dest),
                "moved_outside_scope": self.is_outside_monitored_scope(dest)
            }
        self.event_callback(event_data)

    def on_modified(self, event):
        self._handle_event(event, "modified")

    def on_deleted(self, event):
        if self.should_ignore(event.src_path):
            return
        if "ThreatTron_ITD" in event.src_path:
            return
        now = time.time()
        self.recent_deletes[event.src_path] = now
        threading.Timer(0.5, self._deferred_delete, args=[event.src_path, event.is_directory, now]).start()

    def _deferred_delete(self, path, is_directory, delete_time):
        if path not in self.recent_deletes:
            return
        if time.time() - delete_time > 3:
            return
        del self.recent_deletes[path]
        event_data = base_event("file_activity")
        event_data["metadata"] = {
            "file_path": path,
            "action": "deleted",
            "is_directory": is_directory,
            "file_size": None
        }
        self.event_callback(event_data)

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
        self.suppress_modifications[path] = now
        parent = os.path.dirname(path)
        self.suppress_modifications[parent] = now

    def _handle_event(self, event, action):
        if time.time() - self.start_time < 3:
            return
        if self.should_ignore(event.src_path):
            return
        if "ThreatTron_ITD" in event.src_path:
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
        event_data = base_event("file_activity")
        size = None
        if not event.is_directory:
            try:
                if os.path.exists(event.src_path):
                    size = os.path.getsize(event.src_path)
            except Exception:
                size = None
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
        thread = threading.Thread(target=self._keep_alive)
        thread.daemon = True
        thread.start()
    
    def _keep_alive(self):
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.observer.stop()
        self.observer.join()
import os
import psutil
import time
# import hashlib
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from utils.config import base_event
from utils.config import MONITORED_DIRECTORIES

class CorporateFileHandler(FileSystemEventHandler):

    def __init__(self, event_callback):
        self.event_callback = event_callback

    def on_created(self, event):
        self._handle_event(event, "created")

    def on_modified(self, event):
        self._handle_event(event, "modified")

    def on_deleted(self, event):
        self._handle_event(event, "deleted")

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

    def on_moved(self, event):
        event_data = base_event("file_moved")
        event_data["metadata"] = {
            "source_path": event.src_path,
            "destination_path": event.dest_path,
            "is_directory": event.is_directory,
            "external_transfer": self.is_external_drive(event.dest_path),
            "moved_outside_scope": self.is_outside_monitored_scope(event.dest_path)
        }
        self.event_callback(event_data)

    def _handle_event(self, event, action):
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
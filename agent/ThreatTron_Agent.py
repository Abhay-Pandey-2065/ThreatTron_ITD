#!/usr/bin/env python3
"""ThreatTron Agent - single-file console version.

Windows, how to use:
  1. Copy this file anywhere, for example to your Desktop.
  2. Double-click it. A PowerShell window opens with a menu.
  3. Set the backend address, add the folders to watch, then choose "Run agent".

Only monitor computers and folders you own or are authorised to monitor.
File contents are never read. Email collection is not included.

Settings are saved in threattron_agent_config.json next to this file.
Command-line options:
  --run    start collecting straight away with the saved settings
  --here   do not open a new PowerShell window (use the current terminal)
"""

import os
import subprocess
import sys


def open_in_powershell():
    """Windows: open this script in a new PowerShell window. The child process skips this step."""
    python = sys.executable
    if python.lower().endswith("pythonw.exe"):
        console_python = python[: -len("pythonw.exe")] + "python.exe"
        if os.path.exists(console_python):
            python = console_python
    script = os.path.abspath(__file__)

    def quoted(text):
        return "'" + text.replace("'", "''") + "'"

    command = f"$env:TT_IN_SHELL = '1'; & {quoted(python)} {quoted(script)}"
    subprocess.Popen(
        ["powershell.exe", "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
        creationflags=subprocess.CREATE_NEW_CONSOLE,
    )


def ensure_packages():
    """Install psutil, requests and watchdog with pip if they are missing (asks first)."""
    import importlib

    missing = []
    for module in ("psutil", "requests", "watchdog"):
        try:
            importlib.import_module(module)
        except ImportError:
            missing.append(module)
    if not missing:
        return
    print("This agent needs these Python packages, which are not installed: " + ", ".join(missing))
    answer = input("Install them now with pip? [Y/n] ").strip().lower()
    if answer not in ("", "y", "yes"):
        raise SystemExit("The agent cannot run without these packages.")
    if subprocess.call([sys.executable, "-m", "pip", "install", "--disable-pip-version-check", *missing]) != 0:
        raise SystemExit("Installing the packages failed. Check the internet connection and try again.")
    importlib.invalidate_caches()


if __name__ == "__main__":
    _flags = set(sys.argv[1:])
    if os.name == "nt" and not (_flags & {"--here", "--run"}) and not os.environ.get("TT_IN_SHELL"):
        open_in_powershell()
        raise SystemExit(0)
    ensure_packages()


# ----------------------------------------------------------------------------- imports

import copy
import hashlib
import json
import socket
import struct
import threading
import time
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from queue import Empty, Queue
from urllib.parse import urlparse

import psutil
import requests
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

# ----------------------------------------------------------------------------- settings

CONFIG_PATH = Path(__file__).resolve().parent / "threattron_agent_config.json"
DEFAULT_BACKEND = "https://threattron-itd-backend.onrender.com"
EVENTS_PATH = "/events/batch"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}

DEFAULTS = {
    "backend_url": DEFAULT_BACKEND,
    "monitored_directories": [],
    "process_interval": 10,
    "network_interval": 15,
    "send_interval": 10,
}
LIMITS = {  # key: (label, lowest, highest)
    "process_interval": ("Process check interval (seconds)", 2, 300),
    "network_interval": ("Network check interval (seconds)", 2, 300),
    "send_interval": ("Send interval (seconds)", 2, 300),
}


class SettingsError(ValueError):
    """A setting that cannot be used. The message is written to be shown to the user."""


def normalize_backend(value):
    """Return the backend base address, e.g. https://example.onrender.com (a full /events/batch URL is accepted)."""
    text = str(value or "").strip()
    if not text:
        raise SettingsError("The backend address is empty.")
    if "://" not in text:
        host = text.split("/")[0].split(":")[0].lower()
        text = ("http://" if host in LOCAL_HOSTS else "https://") + text
    parsed = urlparse(text)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in ("http", "https") or not host:
        raise SettingsError("The backend address is not valid. Example: https://your-service.onrender.com")
    if parsed.username or parsed.password:
        raise SettingsError("Do not include a user name or password in the backend address.")
    if parsed.scheme == "http" and host not in LOCAL_HOSTS:
        raise SettingsError("Use https:// for the backend (http:// is only allowed for localhost).")
    path = parsed.path.rstrip("/")
    if path.endswith(EVENTS_PATH):
        path = path[: -len(EVENTS_PATH)]
    return f"{parsed.scheme}://{parsed.netloc}{path}"


def events_url(base):
    return normalize_backend(base) + EVENTS_PATH


def normalize_folders(values):
    """Trim quotes and spaces, normalise the path and drop duplicates."""
    if isinstance(values, str):
        values = [values]
    result, seen = [], set()
    for raw in values or []:
        text = str(raw).strip().strip('"').strip()
        if not text:
            continue
        path = os.path.normpath(text)
        key = os.path.normcase(path)
        if key not in seen:
            seen.add(key)
            result.append(path)
    return result


def whole_number(value, key):
    label, low, high = LIMITS[key]
    try:
        number = int(str(value).strip())
    except ValueError:
        raise SettingsError(f"{label} must be a whole number from {low} to {high}.") from None
    if not low <= number <= high:
        raise SettingsError(f"{label} must be from {low} to {high}.")
    return number


def clean_settings(raw):
    settings = copy.deepcopy(DEFAULTS)
    settings["backend_url"] = normalize_backend(raw.get("backend_url", DEFAULT_BACKEND))
    settings["monitored_directories"] = normalize_folders(raw.get("monitored_directories", []))
    for key in LIMITS:
        settings[key] = whole_number(raw.get(key, DEFAULTS[key]), key)
    return settings


def load_config(path=CONFIG_PATH):
    """Return (settings, problems). Bad values fall back to their defaults and are reported."""
    settings = copy.deepcopy(DEFAULTS)
    problems = []
    if not path.exists():
        return settings, problems
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raise ValueError("it does not contain a settings object")
    except (OSError, ValueError) as exc:
        return settings, [f"Could not read {path.name} ({exc}). Using the default settings."]
    for key in DEFAULTS:
        if key in raw:
            try:
                settings[key] = clean_settings({key: raw[key]})[key]
            except SettingsError as exc:
                problems.append(str(exc))
    return settings, problems


def save_config(settings, path=CONFIG_PATH):
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(settings, indent=2), encoding="utf-8")
    os.replace(temporary, path)


# ----------------------------------------------------------------------------- identity and events

def now_iso():
    return datetime.now(timezone.utc).isoformat()


def _mac_address():
    try:
        value = uuid.getnode()
        if (value >> 40) & 1:
            return "000000000000"
        return f"{value:012x}"
    except Exception:
        return "000000000000"


class Session:
    def __init__(self):
        self.hostname = socket.gethostname()
        self.mac = _mac_address()
        digest = hashlib.sha256(f"{self.mac}::{self.hostname.lower()}".encode("utf-8")).hexdigest()
        self.agent_id = f"agent-{digest[:16]}"
        self.renew()

    def renew(self):
        self.session_id = str(uuid.uuid4())
        self.started_at = now_iso()

    def info(self):
        return {
            "agent_id": self.agent_id,
            "session_id": self.session_id,
            "started_at": self.started_at,
            "hostname": self.hostname.lower(),
            "mac_address": self.mac,
        }


SESSION = Session()


def base_event(event_type):
    return {
        "event_type": event_type,
        "agent_id": SESSION.agent_id,
        "session_id": SESSION.session_id,
        "timestamp": now_iso(),
    }


def lifecycle_event(kind):
    event = base_event(kind)
    event["hostname"] = SESSION.hostname
    event["metadata"] = SESSION.info()
    return event


def system_activity():
    event = base_event("system_activity")
    event["hostname"] = SESSION.hostname
    event["metadata"] = {
        "cpu_usage": psutil.cpu_percent(interval=None),
        "memory_usage": psutil.virtual_memory().percent,
        "active_users": len(psutil.users()),
    }
    return event


def post_events(url, events):
    try:
        response = requests.post(url, json={"events": events}, timeout=60)
    except requests.RequestException as exc:
        print(f"  could not send {len(events)} events ({exc.__class__.__name__})")
        return False
    if response.ok:
        print(f"  sent {len(events)} events")
        return True
    print(f"  the server rejected {len(events)} events (status {response.status_code})")
    return False


# ----------------------------------------------------------------------------- file activity

IGNORED_PATHS = [
    ".git", "__pycache__", "node_modules", ".venv", "AppData", "Temp",
    ".vscode", ".gradle", ".m2", ".npm", "dist", "build", "out",
    ".pytest_cache", ".tox", "venv", ".idea", ".mypy_cache",
    "target", ".next", ".nuxt", "*.tmp", "*.bak",
    "vendor", ".cargo", "Thumbs.db", "Desktop.ini", ".DS_Store",
]
IGNORED_EXTENSIONS = {
    ".tmp", ".bak", ".swp", ".swo", ".log", ".lock", ".pid",
    ".cache", ".class", ".pyc", ".pyo", ".exe", ".dll", ".so",
    ".coverage", ".lcov", ".profdata",
}


def _read_recycle_info(path):
    """Read a Windows Recycle Bin $I file: (original path, deleted time as a Windows FILETIME)."""
    try:
        with open(path, "rb") as fh:
            data = fh.read()
        if len(data) < 28:
            return None
        deleted_at = struct.unpack_from("<q", data, 16)[0]
        original = data[28:].decode("utf-16-le").rstrip("\x00")
        return original, deleted_at
    except Exception:
        return None


class FileActivityHandler(FileSystemEventHandler):
    def __init__(self, emit, watched_folders):
        self.emit = emit
        self.watched = [os.path.abspath(folder).lower() for folder in watched_folders]
        self.start_time = time.time()
        self.last_events = {}
        self.recent_deletes = {}
        self.suppress = {}
        self.lock = threading.Lock()

    def on_created(self, event):
        if self.should_ignore(event.src_path):
            return
        now = time.time()
        matched = None
        for path, entry in list(self.recent_deletes.items()):
            if now - entry["time"] > 3:
                del self.recent_deletes[path]
                continue
            if os.path.basename(path) != os.path.basename(event.src_path):
                continue
            src_dir, dest_dir = os.path.dirname(path), os.path.dirname(event.src_path)
            if src_dir == dest_dir:
                data = base_event("file_renamed")
                data["metadata"] = {
                    "action": "renamed",
                    "old_name": os.path.basename(path),
                    "new_name": os.path.basename(event.src_path),
                    "directory": src_dir,
                    "is_directory": event.is_directory,
                }
            else:
                data = base_event("file_moved")
                data["metadata"] = {
                    "action": "moved",
                    "source_path": path,
                    "destination_path": event.src_path,
                    "is_directory": event.is_directory,
                    "external_transfer": self.is_external_drive(event.src_path),
                    "moved_outside_scope": self.is_outside_scope(event.src_path),
                }
            matched = path
            self.emit(data)
            break
        if matched:
            del self.recent_deletes[matched]
        else:
            self._handle(event, "created")

    def on_moved(self, event):
        if self.should_ignore(event.src_path) or self.should_ignore(event.dest_path):
            return
        src, dest = event.src_path, event.dest_path
        src_dir, dest_dir = os.path.dirname(src), os.path.dirname(dest)
        now = time.time()
        with self.lock:
            for path in (src, dest, src_dir, dest_dir):
                self.suppress[path] = now
        if src_dir == dest_dir:
            data = base_event("file_renamed")
            data["metadata"] = {
                "action": "renamed",
                "old_name": os.path.basename(src),
                "new_name": os.path.basename(dest),
                "directory": src_dir,
                "is_directory": event.is_directory,
            }
        else:
            data = base_event("file_moved")
            data["metadata"] = {
                "action": "moved",
                "source_path": src,
                "destination_path": dest,
                "is_directory": event.is_directory,
                "external_transfer": self.is_external_drive(dest),
                "moved_outside_scope": self.is_outside_scope(dest),
            }
        self.emit(data)

    def on_modified(self, event):
        # wait briefly so rapid repeated writes are reported once
        threading.Timer(0.5, self._handle, args=[event, "modified"]).start()

    def on_deleted(self, event):
        if self.should_ignore(event.src_path):
            return
        size = None
        try:
            if os.path.exists(event.src_path):
                size = os.path.getsize(event.src_path)
        except OSError:
            pass
        self.recent_deletes[event.src_path] = {"time": time.time(), "is_directory": event.is_directory, "size": size}
        threading.Timer(0.5, self._deferred_delete, args=[event.src_path]).start()

    def _deferred_delete(self, path):
        entry = self.recent_deletes.pop(path, None)
        if entry is None or time.time() - entry["time"] > 3:
            return
        is_dir = entry["is_directory"]
        action, outside = "deleted", False
        if not is_dir and not self._in_recycle_bin(os.path.basename(path), max_age=5):
            action, outside = "moved_outside_scope", True
        data = base_event("file_activity")
        data["metadata"] = {
            "file_path": path,
            "action": action,
            "is_directory": is_dir,
            "file_size": entry["size"],
            "moved_outside_scope": outside,
        }
        self.emit(data)

    def _in_recycle_bin(self, filename, max_age):
        now_filetime = int((time.time() + 11644473600) * 10_000_000)
        for part in psutil.disk_partitions(all=False):
            for name in ("$Recycle.Bin", "RECYCLER"):
                root = os.path.join(part.mountpoint, name)
                if not os.path.isdir(root):
                    continue
                try:
                    for user_dir in os.scandir(root):
                        if not user_dir.is_dir():
                            continue
                        for item in os.scandir(user_dir.path):
                            if not item.name.startswith("$I"):
                                continue
                            info = _read_recycle_info(item.path)
                            if info is None:
                                continue
                            original, deleted_at = info
                            if os.path.basename(original) != filename:
                                continue
                            age = (now_filetime - deleted_at) / 10_000_000
                            if 0 <= age <= max_age:
                                return True
                except OSError:
                    continue
        return False

    def is_outside_scope(self, path):
        lowered = os.path.abspath(path).lower()
        return not any(lowered.startswith(folder) for folder in self.watched)

    def is_external_drive(self, path):
        for part in psutil.disk_partitions(all=False):
            if "removable" in part.opts.lower() and path.startswith(part.mountpoint):
                return True
        return False

    def should_ignore(self, path):
        if "ThreatTron_ITD" in path:  # the project's own files
            return True
        lowered = path.lower()
        if any(item.lower() in lowered for item in IGNORED_PATHS):
            return True
        _, ext = os.path.splitext(path)
        if ext.lower() in IGNORED_EXTENSIONS:
            return True
        try:
            if os.path.exists(path) and getattr(os.stat(path), "st_file_attributes", 0) & 0x02:
                return True  # hidden file (Windows)
        except OSError:
            pass
        return False

    def _handle(self, event, action):
        if time.time() - self.start_time < 3:
            return
        if self.should_ignore(event.src_path):
            return
        now = time.time()
        with self.lock:
            self.suppress = {p: t for p, t in self.suppress.items() if now - t < 10}
            if action in ("modified", "deleted"):
                for p in self.suppress:
                    if event.src_path == p or event.src_path.startswith(p + os.sep) or p.startswith(event.src_path + os.sep):
                        return
            key = (event.src_path, action)
            last = self.last_events.get(key)
            if last is not None and now - last < 10:
                return
            self.last_events[key] = now
        size = None
        if not event.is_directory:
            try:
                if os.path.exists(event.src_path):
                    size = os.path.getsize(event.src_path)
            except OSError:
                pass
        data = base_event("file_activity")
        data["metadata"] = {
            "file_path": event.src_path,
            "action": action,
            "is_directory": event.is_directory,
            "file_size": size,
        }
        self.emit(data)


class FileMonitor:
    """Watches each chosen folder (and everything inside it) with its own observer thread."""

    def __init__(self, folders, emit):
        self.folders = list(folders)
        self.emit = emit
        self.observers = []

    def start(self):
        for folder in self.folders:
            if not os.path.isdir(folder):
                print(f"  skipping a folder that does not exist: {folder}")
                continue
            observer = Observer()
            observer.daemon = True
            observer.schedule(FileActivityHandler(self.emit, self.folders), folder, recursive=True)
            observer.start()
            self.observers.append(observer)
            print(f"  watching {folder}")

    def stop(self):
        for observer in self.observers:
            observer.stop()
        for observer in self.observers:
            observer.join(timeout=5)


# ----------------------------------------------------------------------------- processes

ADMIN_TOOLS = {
    "powershell.exe", "cmd.exe", "wmic.exe", "wscript.exe", "cscript.exe",
    "mshta.exe", "rundll32.exe", "regsvr32.exe", "certutil.exe", "net.exe",
    "netsh.exe", "schtasks.exe", "taskkill.exe", "reg.exe", "psexec.exe",
}
BENIGN_PARENTS = {
    "explorer.exe", "taskeng.exe", "taskhostw.exe", "svchost.exe", "services.exe",
    "wininit.exe", "userinit.exe", "conhost.exe", "python.exe", "code.exe", "windowsterminal.exe",
}


def _parent_of(pid):
    try:
        parent = psutil.Process(pid).parent()
        if parent:
            return parent.name(), parent.pid
    except psutil.Error:
        pass
    return None, None


def _process_snapshot():
    processes = {}
    for proc in psutil.process_iter(["pid", "name", "exe"]):
        try:
            info = proc.info
            if not info["exe"]:
                continue
            parent_name, parent_pid = _parent_of(info["pid"])
            processes[info["pid"]] = {
                "name": info["name"] or "unknown",
                "exe": info["exe"],
                "parent_name": parent_name,
                "parent_pid": parent_pid,
            }
        except psutil.Error:
            continue
    return processes


def _suspicious_spawn(child, parent):
    return child.lower() in ADMIN_TOOLS and parent is not None and parent.lower() not in BENIGN_PARENTS


class ProcessMonitor:
    def __init__(self, emit, interval, stop_event):
        self.emit = emit
        self.interval = interval
        self.stop_event = stop_event
        self.thread = None
        self.baseline = _process_snapshot()

    def start(self):
        self.thread = threading.Thread(target=self._loop, name="process-monitor", daemon=True)
        self.thread.start()

    def stop(self):
        if self.thread is not None:
            self.thread.join(timeout=self.interval + 1)

    def _loop(self):
        while not self.stop_event.is_set():
            current = _process_snapshot()
            for pid in set(current) - set(self.baseline):
                info = current[pid]
                name = info["name"]
                data = base_event("process_started")
                data["metadata"] = {
                    "process_name": name,
                    "exe_path": info["exe"],
                    "pid": pid,
                    "parent_name": info["parent_name"],
                    "parent_pid": info["parent_pid"],
                    "is_admin_tool": name.lower() in ADMIN_TOOLS,
                    "suspicious_spawn": _suspicious_spawn(name, info["parent_name"]),
                }
                self.emit(data)
            for pid in set(self.baseline) - set(current):
                info = self.baseline[pid]
                name = info["name"]
                data = base_event("process_terminated")
                data["metadata"] = {
                    "process_name": name,
                    "exe_path": info["exe"],
                    "pid": pid,
                    "parent_name": info["parent_name"],
                    "parent_pid": info["parent_pid"],
                    "is_admin_tool": name.lower() in ADMIN_TOOLS,
                    "suspicious_spawn": False,
                }
                self.emit(data)
            self.baseline = current
            self.stop_event.wait(self.interval)


# ----------------------------------------------------------------------------- network

def _hash_ip(ip):
    """Salted SHA-256, so IP addresses are never sent in plain text (same scheme as the original agent)."""
    return hashlib.sha256((HASH_SALT + ip).encode("utf-8")).hexdigest()


HASH_SALT = "threattron_salt_v1"
IGNORED_REMOTE_PORTS = {80, 443, 53, 123}
IGNORED_IP_PREFIXES = ("127.", "::1", "0.0.0.0", "169.254.")


class NetworkMonitor:
    def __init__(self, emit, interval, stop_event):
        self.emit = emit
        self.interval = interval
        self.stop_event = stop_event
        self.thread = None
        self.seen = set()

    def start(self):
        self.thread = threading.Thread(target=self._loop, name="network-monitor", daemon=True)
        self.thread.start()

    def stop(self):
        if self.thread is not None:
            self.thread.join(timeout=self.interval + 1)

    def _loop(self):
        while not self.stop_event.is_set():
            try:
                self._collect()
            except Exception as exc:
                print(f"  network check failed: {exc}")
            self.stop_event.wait(self.interval)

    def _collect(self):
        names = {}
        for proc in psutil.process_iter(["pid", "name"]):
            names[proc.info["pid"]] = proc.info["name"]
        try:
            connections = psutil.net_connections(kind="inet")
        except (psutil.AccessDenied, OSError):
            return
        current = set()
        for conn in connections:
            if not conn.laddr or not conn.raddr:
                continue
            remote_ip, remote_port = conn.raddr.ip, conn.raddr.port
            if remote_ip.startswith(IGNORED_IP_PREFIXES) or remote_port in IGNORED_REMOTE_PORTS:
                continue
            local_hash, remote_hash = _hash_ip(conn.laddr.ip), _hash_ip(remote_ip)
            key = (local_hash, remote_hash, remote_port, conn.pid, conn.status)
            current.add(key)
            if key in self.seen:
                continue
            data = base_event("network_connection")
            data["metadata"] = {
                "local_ip_hash": local_hash,
                "local_port": conn.laddr.port,
                "remote_ip_hash": remote_hash,
                "remote_port": remote_port,
                "status": conn.status,
                "pid": conn.pid,
                "process_name": names.get(conn.pid) if conn.pid else None,
            }
            self.emit(data)
        self.seen = current


# ----------------------------------------------------------------------------- USB

def _removable_mounts():
    return {p.mountpoint for p in psutil.disk_partitions(all=False) if "removable" in p.opts.lower()}


def _used_bytes(mount):
    try:
        return psutil.disk_usage(mount).used
    except Exception:
        return None


class UsbMonitor:
    def __init__(self, emit, interval, stop_event):
        self.emit = emit
        self.interval = interval
        self.stop_event = stop_event
        self.thread = None
        self.previous = _removable_mounts()
        self.usage_at_insert = {}
        self.last_usage = {}

    def start(self):
        self.thread = threading.Thread(target=self._loop, name="usb-monitor", daemon=True)
        self.thread.start()

    def stop(self):
        if self.thread is not None:
            self.thread.join(timeout=self.interval + 1)

    def _loop(self):
        while not self.stop_event.is_set():
            current = _removable_mounts()
            for device in current - self.previous:
                usage = _used_bytes(device)
                self.usage_at_insert[device] = usage if usage is not None else 0
                data = base_event("usb_inserted")
                data["metadata"] = {"mountpoint": device, "used_bytes_at_insert": usage}
                self.emit(data)
            for device in self.previous - current:
                baseline = self.usage_at_insert.pop(device, None)
                last = self.last_usage.get(device)
                written = max(last - baseline, 0) if baseline is not None and last is not None else None
                data = base_event("usb_removed")
                data["metadata"] = {
                    "mountpoint": device,
                    "write_delta_bytes": written,
                    "write_delta_mb": round(written / (1024 * 1024), 2) if written is not None else None,
                }
                self.emit(data)
            self.last_usage = {}
            for device in current:
                usage = _used_bytes(device)
                if usage is not None:
                    self.last_usage[device] = usage
            self.previous = current
            self.stop_event.wait(self.interval)


# ----------------------------------------------------------------------------- running the agent

def drain(events):
    items = []
    while True:
        try:
            items.append(events.get_nowait())
        except Empty:
            return items


def run_agent(settings):
    """Collect until Ctrl+C. Returns normally after Ctrl+C; other errors are raised."""
    url = events_url(settings["backend_url"])
    stop_event = threading.Event()
    collected = Queue()

    def emit(event):
        event["hostname"] = SESSION.hostname
        collected.put(event)

    def send(events):
        if post_events(url, events):
            STATS["sent"] += len(events)
        else:
            STATS["failed"] += 1

    STATS["sent"] = STATS["failed"] = 0
    monitors = [
        FileMonitor(settings["monitored_directories"], emit),
        UsbMonitor(emit, 5, stop_event),
        ProcessMonitor(emit, settings["process_interval"], stop_event),
        NetworkMonitor(emit, settings["network_interval"], stop_event),
    ]
    print(f"Starting agent {SESSION.agent_id} (session {SESSION.session_id[:8]}) -> {url}")
    try:
        for monitor in monitors:
            monitor.start()
        send([lifecycle_event("session_started")])
        print("Collecting. Press Ctrl+C to stop and return to the menu.")
        last_send = time.monotonic()
        while True:
            time.sleep(0.5)
            if time.monotonic() - last_send < settings["send_interval"]:
                continue
            last_send = time.monotonic()
            batch = drain(collected)
            batch.append(system_activity())
            send(batch)
    except KeyboardInterrupt:
        print("Stopping...")
    finally:
        stop_event.set()
        for monitor in monitors:
            try:
                monitor.stop()
            except Exception:
                pass
        send([lifecycle_event("session_stopped")])
        print(f"Stopped. Events sent: {STATS['sent']}. Failed sends: {STATS['failed']}.")


STATS = {"sent": 0, "failed": 0}


# ----------------------------------------------------------------------------- console menu

def ask(prompt, default=""):
    try:
        answer = input(prompt).strip()
    except EOFError:
        raise SystemExit(0)
    return answer or default


def store(settings):
    try:
        save_config(settings)
        return True
    except OSError as exc:
        print(f"  Could not save the settings: {exc}")
        return False


def show_menu(settings):
    folders = settings["monitored_directories"]
    print()
    print("=" * 60)
    print(" ThreatTron Agent")
    print("=" * 60)
    print(f" Backend address : {settings['backend_url']}")
    print(f" Folders         : {len(folders)}")
    for number, folder in enumerate(folders, 1):
        print(f"     {number}. {folder}")
    if not folders:
        print("     (none - file activity will not be collected)")
    print(f" Process check   : every {settings['process_interval']} s")
    print(f" Network check   : every {settings['network_interval']} s")
    print(f" Send batches    : every {settings['send_interval']} s")
    print(f" Config file     : {CONFIG_PATH}")
    print("-" * 60)
    print(" [1] Set backend address")
    print(" [2] Test backend connection")
    print(" [3] Add a folder")
    print(" [4] Remove a folder")
    print(" [5] Change timing settings")
    print(" [6] RUN AGENT (Ctrl+C stops it and returns here)")
    print(" [0] Quit")
    print("-" * 60)


def set_backend(settings):
    raw = ask(f"Backend address [{settings['backend_url']}]: ")
    if not raw:
        return
    try:
        settings["backend_url"] = normalize_backend(raw)
    except SettingsError as exc:
        print(f"  {exc}")
        return
    if store(settings):
        print(f"  Saved. Events will go to {events_url(settings['backend_url'])}")


def test_backend(settings):
    base = settings["backend_url"]
    print("  Checking... (a sleeping free-tier server can take up to a minute)")
    try:
        response = requests.get(base + "/", timeout=60)
    except requests.exceptions.SSLError:
        print("  The secure connection failed (certificate problem).")
        return
    except requests.exceptions.Timeout:
        print("  No answer in time. Try again in a minute.")
        return
    except requests.RequestException as exc:
        print(f"  Could not connect ({exc.__class__.__name__}). Check the address and the internet connection.")
        return
    if response.ok:
        print("  Connected. The backend answered.")
    else:
        print(f"  The server answered with status {response.status_code}. Check the address.")


def add_folder(settings):
    path = ask("Folder path (you can also drag the folder into this window): ").strip('"')
    if not path:
        return
    if not os.path.isdir(path):
        print("  That folder does not exist.")
        return
    before = settings["monitored_directories"]
    after = normalize_folders(before + [path])
    if len(after) == len(before):
        print("  That folder is already in the list.")
        return
    settings["monitored_directories"] = after
    if store(settings):
        print("  Folder added.")


def remove_folder(settings):
    folders = settings["monitored_directories"]
    if not folders:
        print("  There are no folders to remove.")
        return
    for number, folder in enumerate(folders, 1):
        print(f"    {number}. {folder}")
    choice = ask("Number to remove (Enter to cancel): ")
    if not choice:
        return
    if not choice.isdigit() or not 1 <= int(choice) <= len(folders):
        print("  That is not a number from the list.")
        return
    removed = folders.pop(int(choice) - 1)
    if store(settings):
        print(f"  Removed {removed}.")


def change_timing(settings):
    for key, (label, _low, _high) in LIMITS.items():
        current = settings[key]
        raw = ask(f"{label} [{current}]: ", str(current))
        try:
            settings[key] = whole_number(raw, key)
        except SettingsError as exc:
            print(f"  {exc} Kept {current}.")
    if store(settings):
        print("  Saved. The new timing applies the next time the agent runs.")


def run_from_menu(settings):
    if not settings["monitored_directories"]:
        answer = ask("No folders are selected, so file activity will not be collected. Continue? [y/N] ")
        if answer.lower() not in ("y", "yes"):
            return
    try:
        run_agent(settings)
    except Exception:
        print("The agent stopped because of an error:")
        traceback.print_exc()


def main(argv):
    settings, problems = load_config()
    for problem in problems:
        print("Warning: " + problem)

    if "--run" in argv:
        if not settings["monitored_directories"]:
            print("Warning: no folders are selected, so file activity will not be collected.")
        try:
            run_agent(settings)
            return 0
        except Exception:
            traceback.print_exc()
            return 1

    actions = {
        "1": set_backend, "2": test_backend, "3": add_folder,
        "4": remove_folder, "5": change_timing,
    }
    while True:
        show_menu(settings)
        choice = ask("Choose: ")
        if choice == "0":
            print("Bye.")
            return 0
        if choice == "6":
            run_from_menu(settings)
        elif choice in actions:
            actions[choice](settings)
            ask("  Press Enter to return to the menu...")
        else:
            print("  Please type one of the numbers shown.")


if __name__ == "__main__":
    try:
        exit_code = main(sys.argv[1:])
    except KeyboardInterrupt:
        print("\nBye.")
        exit_code = 0
    sys.exit(exit_code)

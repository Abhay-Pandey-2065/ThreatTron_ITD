import psutil
import hashlib
import time
import threading
from utils.config import base_event

SALT = "threattron_salt_v1"

IGNORED_REMOTE_PORTS = {80, 443, 53, 123}
IGNORED_IP_PREFIXES = {"127.", "::1", "0.0.0.0", "169.254."}

def _hash_ip(ip: str) -> str:
    h = hashlib.sha256()
    h.update(SALT.encode())
    h.update(ip.encode())
    return h.hexdigest()

def _get_pid_to_name() -> dict:
    mapping = {}
    for proc in psutil.process_iter(["pid", "name"]):
        try:
            mapping[proc.info["pid"]] = proc.info["name"]
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return mapping

class NetworkMonitor:

    def __init__(self, event_callback, interval: int = 15):
        self.event_callback = event_callback
        self.interval = interval
        self._seen_connections: set = set()

    def start(self):
        thread = threading.Thread(target = self._monitor_loop, daemon=True)
        thread.start()

    def _monitor_loop(self):
        while True:
            self._collect()
            time.sleep(self.interval)
    
    def _collect(self):
        pid_to_name = _get_pid_to_name()
        current_seen = set()
        now = time.time()

        try:
            connections = psutil.net_connections(kind="inet")
        except (psutil.AccessDenied, OSError):
            return
        
        for conn in connections:
            if not conn.laddr or not conn.raddr:
                continue

            remote_ip = conn.raddr.ip
            remote_port = conn.raddr.port
            local_ip = conn.laddr.ip

            if any(remote_ip.startswith(p) for p in IGNORED_IP_PREFIXES):
                continue
            if remote_port in IGNORED_REMOTE_PORTS:
                continue
            pid = conn.pid
            process_name = pid_to_name.get(pid) if pid else None
            remote_hash = _hash_ip(remote_ip)
            local_hash = _hash_ip(local_ip)

            dedup_key = (local_hash, remote_hash, remote_port, pid, conn.status)
            current_seen.add(dedup_key)

            if dedup_key in self._seen_connections:
                continue

            event = base_event("network_connection")
            event["metadata"] = {
                "local_ip_hash": local_hash,
                "local_port": conn.laddr.port,
                "remote_ip_hash": remote_hash,
                "remote_port": remote_port,
                "status": conn.status,
                "pid": pid,
                "process_name": process_name,
            }
            self.event_callback(event)
        self._seen_connections = current_seen
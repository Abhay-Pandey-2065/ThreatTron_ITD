import os
import time
import socket
from queue import Queue, Empty
from collector.process_monitor import ProcessMonitor
from collector.network_monitor import NetworkMonitor
from collector.system_collector import collect_system_activity
from collector.file_collector import FileMonitor
from collector.usb_monitor import USBMonitor
from mail.email_monitor import EmailMonitor
from sender.sender import send_events
from utils.config import MONITORED_DIRECTORIES, base_event
from utils.session import session as agent_session

EMAIL_ENABLED = os.environ.get("THREATTRON_EMAIL_ENABLED", "false").lower() == "true"

event_queue = Queue()
HOSTNAME = socket.gethostname()

def event_callback(event):
    event["hostname"] = HOSTNAME
    event_queue.put(event)

def run_agent():
    session_event = base_event("session_started")
    session_event["hostname"] = HOSTNAME
    session_event["metadata"] = agent_session.to_dict()
    send_events([session_event])
    
    file_monitor = FileMonitor(MONITORED_DIRECTORIES, event_callback)
    file_monitor.start()

    usb_monitor = USBMonitor(event_callback)
    usb_monitor.start()

    process_monitor = ProcessMonitor(event_callback, interval=10)
    process_monitor.start()

    network_monitor = NetworkMonitor(event_callback, interval=15)
    network_monitor.start()

    if EMAIL_ENABLED:
        email_monitor = EmailMonitor(event_callback, interval = 30)
        email_monitor.start()

    while True:
        events = []
        
        try:
            while True:
                events.append(event_queue.get_nowait())
        except Empty:
            pass

        system_events = collect_system_activity()
        for e in system_events:
            e["hostname"] = HOSTNAME
        events.extend(system_events)

        if events:
            send_events(events)
            
        time.sleep(10)

if __name__ == "__main__":
    run_agent()
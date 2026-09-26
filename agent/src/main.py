import os
import time
import socket
import threading
from queue import Queue, Empty
from collector.process_monitor import ProcessMonitor
from collector.network_monitor import NetworkMonitor
from collector.system_collector import collect_system_activity
from collector.file_collector import FileMonitor
from collector.usb_monitor import USBMonitor
from sender.sender import send_events
from utils.config import MONITORED_DIRECTORIES, THREAD_POOL_SIZE, base_event
from utils.session import session as agent_session

event_queue = Queue()
HOSTNAME = socket.gethostname()

def event_callback(event):
    event["hostname"] = HOSTNAME
    event_queue.put(event)

def run_agent(stop_event=None):
    stop_event = stop_event or threading.Event()
    file_monitor = FileMonitor(MONITORED_DIRECTORIES, event_callback, worker_count=THREAD_POOL_SIZE)
    usb_monitor = USBMonitor(event_callback, stop_event=stop_event)
    process_monitor = ProcessMonitor(event_callback, interval=10, stop_event=stop_event)
    network_monitor = NetworkMonitor(event_callback, interval=15, stop_event=stop_event)
    monitors = [file_monitor, usb_monitor, process_monitor, network_monitor]

    try:
        for monitor in monitors:
            monitor.start()

        session_event = base_event("session_started")
        session_event["hostname"] = HOSTNAME
        session_event["metadata"] = agent_session.to_dict()
        send_events([session_event])

        while not stop_event.is_set():
            events = []

            try:
                while True:
                    events.append(event_queue.get_nowait())
            except Empty:
                pass

            system_events = collect_system_activity()
            for event in system_events:
                event["hostname"] = HOSTNAME
            events.extend(system_events)

            if events:
                send_events(events)

            stop_event.wait(10)
    finally:
        for monitor in monitors:
            monitor.stop()

        stopped_event = base_event("session_stopped")
        stopped_event["hostname"] = HOSTNAME
        stopped_event["metadata"] = agent_session.to_dict()
        send_events([stopped_event])

if __name__ == "__main__":
    run_agent()
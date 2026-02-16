import time
from queue import Queue
from queue import Empty
from collector.process_monitor import ProcessMonitor
from collector.system_collector import collect_system_activity
from collector.file_collector import FileMonitor
from collector.usb_monitor import USBMonitor
from sender.sender import send_events
from mail.email_monitor import EmailMonitor
from utils.config import MONITORED_DIRECTORIES

event_queue = Queue()

def event_callback(event):
    event_queue.put(event)

def run_agent():
    file_monitor = FileMonitor(MONITORED_DIRECTORIES, event_callback)
    file_monitor.start()

    usb_monitor = USBMonitor(event_callback)
    usb_monitor.start()

    process_monitor = ProcessMonitor(event_callback, interval=10)
    process_monitor.start()

    email_monitor = EmailMonitor(event_callback, interval = 30)
    email_monitor.start()

    while True:
        events = []
        
        try:
            while True:
                events.append(event_queue.get_nowait())
        except Empty:
            pass

        events.extend(collect_system_activity())

        if events:
            send_events(events)
            
        time.sleep(10)

if __name__ == "__main__":
    run_agent()
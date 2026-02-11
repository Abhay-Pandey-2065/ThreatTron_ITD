import time
from collector.process_collector import collect_process_activity
from collector.system_collector import collect_system_activity
from collector.file_collector import collect_file_activity
from sender.sender import send_events

def run_agent():
    while True:
        events = []

    events.extend(collect_process_activity)
    events.extend(collect_system_activity)
    events.extend(collect_file_activity)
    send_events(events)
    time.sleep(10)

if __name__ == "__main__":
    run_agent()
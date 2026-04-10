import threading
import time
from .email_collector import GmailCollector
from utils.config import base_event

class EmailMonitor:

    def __init__(self, event_callback, interval=30):
        self.event_callback = event_callback
        self.interval = interval
        self.collector = GmailCollector()
        self.seen_ids = set()

    def start(self):
        thread = threading.Thread(target=self._monitor_loop)
        thread.daemon = True
        thread.start()

    def _monitor_loop(self):
        while True:
            try:
                messages = self.collector.fetch_recent_emails(5)
                for msg in messages:
                    if msg["id"] not in self.seen_ids:
                        full_msg = self.collector.get_messages(msg["id"])
                        features = self.collector.extract_features(full_msg)
                        event = base_event("email_received")
                        event["metadata"] = features
                        self.event_callback(event)
                        self.seen_ids.add(msg["id"])
            except Exception as e:
                print(f"[EmailMonitor] Error fetching emails: {type(e).__name__}: {e}")
            time.sleep(self.interval)
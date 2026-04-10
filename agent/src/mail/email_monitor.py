import threading
import time
import os
import requests
from .email_collector import GmailCollector
from utils.config import base_event

BACKEND_URL = os.environ.get("THREATTRON_BACKEND_URL", "https://threattron-api.onrender.com")

class EmailMonitor:

    def __init__(self, event_callback, interval=30):
        self.event_callback = event_callback
        self.interval = interval
        self.collector = GmailCollector()
        self.seen_ids: set[str] = set()

    def _fetch_stored_ids(self) -> set(str):
        try:
            response = requests.get(
                f"{BACKEND_URL}/emails/known-ids",
                timeout=10
            )
            if response.status_code == 200:
                return set(response.json().get("message_ids", []))
        except Exception as e:
            print(f"[EmailMonitor] Could not fetch stored IDs: {e}")
        return set()

    def start(self):
        self.seen_ids = self._fetch_stored_ids()
        print(f"[EmailMonitor] Pre-loaded {len(self.seen_ids)} known message ID(s) from DB.")

        thread = threading.Thread(target=self._monitor_loop)
        thread.daemon = True
        thread.start()

    def _monitor_loop(self):
        while True:
            try:
                messages = self.collector.fetch_recent_emails(5)
                for msg in messages:
                    msg_id = msg["id"]
                    if msg["id"] not in self.seen_ids:
                        full_msg = self.collector.get_messages(msg["id"])
                        features = self.collector.extract_features(full_msg)
                        features["message_id"] = msg_id
                        event = base_event("email_received")
                        event["metadata"] = features
                        self.event_callback(event)
                        self.seen_ids.add(msg_id)
            except Exception as e:
                print(f"[EmailMonitor] Error fetching emails: {type(e).__name__}: {e}")
            time.sleep(self.interval)
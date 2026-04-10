import os, requests

BACKEND_URL = os.environ.get("THREATTRON_BACKEND_URL", "https://threattron-api.onrender.com/events/batch")

def send_events(events):
    try:
        response = requests.post(BACKEND_URL, json={"events": events}, timeout=60)
        print(f"Sent {response.status_code}")
    except Exception as e:
        print(f"Error sending events: {e}")
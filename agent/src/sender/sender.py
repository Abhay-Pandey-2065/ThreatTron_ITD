# def send_events(events):
#     print("\n================ BATCH SENT ================")

#     for event in events:
#         event_type = event["event_type"]
#         metadata = event.get("metadata", {})

#         # FILE EVENTS
#         if event_type == "file_activity":
#             print(f"[FILE] {metadata.get('action')} → {metadata.get('file_path')}")

#         elif event_type == "file_moved":
#             print(f"[MOVE] {metadata.get('source_path')} → {metadata.get('destination_path')}")
#             if metadata.get("external_transfer"):
#                 print("        ⚠ External Transfer Detected")
#             if metadata.get("moved_outside_scope"):
#                 print("        ⚠ Moved Outside Monitored Scope")

#         # USB EVENTS
#         elif event_type == "usb_inserted":
#             print(f"[USB INSERTED] {metadata.get('mountpoint')}")

#         elif event_type == "usb_removed":
#             print(f"[USB REMOVED] {metadata.get('mountpoint')}")

#         # PROCESS EVENTS
#         elif event_type == "startup_process":
#             print(f"[STARTUP] {metadata.get('process_name')}")

#         elif event_type == "process_started":
#             print(f"[PROCESS STARTED] {metadata.get('process_name')}")

#         elif event_type == "process_terminated":
#             print(f"[PROCESS TERMINATED] {metadata.get('process_name')}")

#         # SYSTEM EVENTS
#         elif event_type == "system_activity":
#             print(f"[SYSTEM] CPU: {metadata.get('cpu_usage')}% | Memory: {metadata.get('memory_usage')}%")

#         # EMAIL EVENTS
#         elif event_type == "email_received":
#             print(f"[EMAIL RECEIVED]")
#             print(f"    From: {metadata.get('sender')}")
#             print(f"    Subject: {metadata.get('subject')}")
#             print(f"    Snippet Length: {metadata.get('snippet_length')}")
#             print(f"    Contains Links: {metadata.get('has_links')}")

#     print("============================================\n")

import requests

BACKEND_URL = "http://127.0.0.1:8000/events/batch"

def send_events(events):
    try:
        response = requests.post(
            BACKEND_URL,
            json = {"events": events}
        )
        print(f"Sent {response.status_code}")
    except Exception as e:
        print(f"Error sending events: {e}")
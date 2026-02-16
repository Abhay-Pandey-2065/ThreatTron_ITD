def send_events(events):
    print("\n================ BATCH SENT ================")

    for event in events:
        event_type = event["event_type"]
        metadata = event.get("metadata", {})

        # FILE EVENTS
        if event_type == "file_activity":
            print(f"[FILE] {metadata.get('action')} → {metadata.get('file_path')}")

        elif event_type == "file_moved":
            print(f"[MOVE] {metadata.get('source_path')} → {metadata.get('destination_path')}")
            if metadata.get("external_transfer"):
                print("        ⚠ External Transfer Detected")
            if metadata.get("moved_outside_scope"):
                print("        ⚠ Moved Outside Monitored Scope")

        # USB EVENTS
        elif event_type == "usb_inserted":
            print(f"[USB INSERTED] {metadata.get('mountpoint')}")

        elif event_type == "usb_removed":
            print(f"[USB REMOVED] {metadata.get('mountpoint')}")

        # PROCESS EVENTS
        elif event_type == "startup_process":
            print(f"[STARTUP] {metadata.get('process_name')}")

        elif event_type == "process_started":
            print(f"[PROCESS STARTED] {metadata.get('process_name')}")

        elif event_type == "process_terminated":
            print(f"[PROCESS TERMINATED] {metadata.get('process_name')}")

        # SYSTEM EVENTS
        elif event_type == "system_activity":
            print(f"[SYSTEM] CPU: {metadata.get('cpu_usage')}% | Memory: {metadata.get('memory_usage')}%")

        # EMAIL EVENTS
        elif event_type == "email_received":
            print(f"[EMAIL RECEIVED]")
            print(f"    From: {metadata.get('sender')}")
            print(f"    Subject: {metadata.get('subject')}")
            print(f"    Snippet Length: {metadata.get('snippet_length')}")
            print(f"    Contains Links: {metadata.get('has_links')}")

    print("============================================\n")

# import requests

# BASE_URL = "http://127.0.0.1:8000/events"

# ENDPOINTS = {
#     "file": f"{BASE_URL}/files",
#     "process": f"{BASE_URL}/processes",
#     "system": f"{BASE_URL}/system",
#     "email": f"{BASE_URL}/emails",
#     "usb": f"{BASE_URL}/usb"
# }

# def categorize_events(events):
#     grouped = {
#         "file": [],
#         "process": [],
#         "system": [],
#         "email": [],
#         "usb": []
#     }

#     for event in events:
#         et = event["event_type"]

#         if et in ["file_activity", "file_moved"]:
#             grouped["file"].append(event)

#         elif et in ["process_started", "process_terminated", "startup_process"]:
#             grouped["process"].append(event)

#         elif et == "system_activity":
#             grouped["system"].append(event)

#         elif et == "email_received":
#             grouped["email"].append(event)

#         elif et in ["usb_inserted", "usb_removed"]:
#             grouped["usb"].append(event)

#     return grouped


# def send_events(events):
#     grouped = categorize_events(events)

#     for key, event_list in grouped.items():
#         if not event_list:
#             continue

#         try:
#             response = requests.post(
#                 ENDPOINTS[key],
#                 json=event_list
#             )
#             print(f"Sent {len(event_list)} {key} events → {response.status_code}")
#         except Exception as e:
#             print(f"Error sending {key} events:", e)


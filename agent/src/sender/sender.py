def send_events(events):
    print("\n================ BATCH SENT ================")

    for event in events:
        event_type = event["event_type"]

        if event_type == "file_activity":
            print(f"[FILE] {event['metadata'].get('action')} → {event['metadata'].get('file_path')}")

        elif event_type == "file_moved":
            print(f"[MOVE] {event['metadata'].get('source_path')} → {event['metadata'].get('destination_path')}")
            if event['metadata'].get('external_transfer'):
                print("        ⚠ External Transfer Detected")
            if event['metadata'].get('moved_outside_scope'):
                print("        ⚠ Moved Outside Monitored Scope")

        elif event_type == "usb_inserted":
            print(f"[USB INSERTED] {event['metadata'].get('mountpoint')}")

        elif event_type == "usb_removed":
            print(f"[USB REMOVED] {event['metadata'].get('mountpoint')}")

        elif event_type == "process_activity":
            print(f"[PROCESS] {event['metadata'].get('process_name')} (CPU: {event['metadata'].get('cpu_percent')}%)")

        elif event_type == "system_activity":
            print(f"[SYSTEM] CPU: {event['metadata'].get('cpu_usage')}% | Memory: {event['metadata'].get('memory_usage')}%")

    print("============================================\n")

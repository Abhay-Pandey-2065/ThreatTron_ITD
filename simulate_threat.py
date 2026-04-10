import requests
import uuid
import time
from datetime import datetime, timezone

# Configuration
# This uses the same backend URL your agent uses
BACKEND_URL = "https://threattron-api.onrender.com/events/batch"
AGENT_ID = "DEMO_ATTACKER_2024"
SESSION_ID = str(uuid.uuid4())
HOSTNAME = "FINANCE-PC-01"

def get_iso_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def run_simulation():
    print(f"🚀 Starting Threat Simulation for Agent: {AGENT_ID}")
    print(f"📦 Session ID: {SESSION_ID}")

    # 1. Start Session (Mandatory for backend to accept data)
    events = [
        {
            "event_type": "session_started",
            "agent_id": AGENT_ID,
            "session_id": SESSION_ID,
            "timestamp": get_iso_now(),
            "metadata": {
                "hostname": HOSTNAME,
                "mac_address": "00:15:5D:01:AF:19"
            }
        }
    ]

    # 2. Add Multiple USB Events (High weight in risk scoring)
    events.append({
        "event_type": "usb_inserted",
        "agent_id": AGENT_ID,
        "session_id": SESSION_ID,
        "timestamp": get_iso_now(),
        "metadata": { "mountpoint": "E:\\" }
    })

    # 3. Add High Volume of Suspicious File Extensions
    # This triggers the 'exe_zip_files' detector
    for i in range(65):
        events.append({
            "event_type": "file_activity",
            "agent_id": AGENT_ID,
            "session_id": SESSION_ID,
            "timestamp": get_iso_now(),
            "metadata": {
                "file_path": f"C:\\Engineering\\PBL-2\\Dummy\\Exfiltration_Data_{i}.zip",
                "action": "created"
            }
        })

    # 4. Add Suspicious Network Ports (Reverse Shell/C2)
    for port in [4444, 8080, 9090, 31337]:
        events.append({
            "event_type": "network_connection",
            "agent_id": AGENT_ID,
            "session_id": SESSION_ID,
            "timestamp": get_iso_now(),
            "metadata": {
                "process_name": "cmd.exe",
                "remote_port": port,
                "status": "ESTABLISHED",
                "remote_ip_hash": "hashed_attacker_ip"
            }
        })

    # 5. NEW: Add Suspicious Processes (This increases the 'Open Alerts' count)
    suspicious_apps = ["mimikatz.exe", "nc.exe", "powershell.exe", "whoami.exe"]
    for app in suspicious_apps:
        events.append({
            "event_type": "process_started",
            "agent_id": AGENT_ID,
            "session_id": SESSION_ID,
            "timestamp": get_iso_now(),
            "metadata": {
                "process_name": app,
                "exe_path": f"C:\\Temp\\{app}",
                "suspicious_spawn": True, # The Dashboard counts this field
                "parent_name": "explorer.exe"
            }
        })

    # 6. Send the Batch
    try:
        print(f"📡 Sending {len(events)} malicious events to API...")
        response = requests.post(BACKEND_URL, json={"events": events}, timeout=15)
        
        if response.status_code == 200:
            print("\n✅ SUCCESS: Threat data injected into the live system.")
            print("📈 ACTION: Refresh your dashboard or wait 5 seconds for the gauge to spike.")
            print("-" * 50)
            print(f"TIP: To focus on this specific attacker in the dashboard, use:")
            print(f"Agent ID: {AGENT_ID}")
        else:
            print(f"❌ FAILED: Backend returned {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"💥 CONNECTION ERROR: Could not reach backend. {e}")

if __name__ == "__main__":
    run_simulation()

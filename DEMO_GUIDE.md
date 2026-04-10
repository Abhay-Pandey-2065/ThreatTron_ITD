# 🚨 Live Demo Guide: Threat Simulation

This guide explains how to use the `simulate_threat.py` script to demonstrate the risk score increasing in real-time.

## 🛠 1. Preparation
Make sure you have the `requests` library installed:
```bash
pip install requests
```

## ⚙️ 2. Configuration
Open `simulate_threat.py` and check the `BACKEND_URL` at the top:

*   **For Cloud Demo (Recommended):**
    ```python
    BACKEND_URL = "https://threattron-api.onrender.com/events/batch"
    ```
*   **For Local Demo (Running server on Port 8000):**
    ```python
    BACKEND_URL = "http://localhost:8000/events/batch"
    ```

## 🚀 3. Steps for the Live Demo

### Step A: The "Healthy" State
1. Open the ThreatTron Dashboard.
2. Navigate to **ML / Insights**.
3. Point out that the **Live Threat Monitor** is low (Green) or zero, and the **Open Alerts** (on Overview) are minimal.

### Step B: Execution
1. Open your terminal in the `ThreatTron_ITD` folder.
2. Run the simulation:
   ```bash
   python simulate_threat.py
   ```
3. The script will inject 70+ malicious signals into the database.

### Step C: The "Reaction"
1. **Wait 5-10 seconds** (the dashboard auto-refreshes).
2. Watch the **Risk Gauge** spike into the **RED (Critical)** zone.
3. Show the panel the **"Behavioral Rules Triggered"** section, highlighting:
   *   `USB_FILE_EXFIL` (since we simulated a USB mount).
   *   `SUSPICIOUS_FILE_TYPES` (the 65 .zip files in the Dummy folder).
   *   `FULL_KILL_CHAIN` (the combination of network, usb, and file activity).

## 💡 Demo Tips
*   **Agent Identity**: The script uses the ID `DEMO_ATTACKER_2024`. You can point this out in the "Agent ID" card on the dashboard to prove it's a specific user being tracked.
*   **Realism**: Mention that the paths used in the script (`C:\Engineering\PBL-2\Dummy\...`) are exactly the ones being monitored by the real collection agent.
*   **Path Change**: you might need to change the path in the script to match your system.('D:\Personal_Projects', instead of ,'C:\Engineering\PBL-2\Dummy') in simulate_threat.py.

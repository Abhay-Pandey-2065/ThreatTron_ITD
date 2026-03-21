# 🛡️ Ethical Network Data Agent

An independent, lightweight Intrusion Detection System (IDS) data collector designed directly with ingrained ethical guardrails. This project securely collects metadata about your machine's active network connections while respecting user privacy and intentionally limiting access to personal payload contents.

## 🌟 What This Agent Does

Traditional packet sniffers (like Wireshark or Scapy) capture raw data off the wire—meaning they can silently record private emails, downloaded files, and plain-text passwords. 

This **Ethical Network Agent** avoids all privacy violations by utilizing the Operating System level APIs (`psutil`) to merely track the *metadata* of where connections are pointing, not what they are carrying. 

It is built upon **4 Defensive Guardrails**:
1. **Explicit Consent**: The agent refuses to start without explicit administrator approval inside `simple_agent.py` (`CONSENT_GRANTED = True`).
2. **No Payload Capture**: Collects only Layer 4 Metadata (Ports, IPs, and Statuses), deliberately ignoring actual message packet payloads (HTTP/HTML/Files).
3. **Cryptographic IP Hashing**: Remote identities are destroyed the moment they are captured, converting raw IPs (e.g. `192.168.1.5`) into anonymous `SHA-256` hash strings.
4. **Data Auto-Purge**: Volatile data expires automatically. A recurring background query destroys all SQLite database records older than 24 hours.

---

## 📊 Significance of the Data Collected

The data is logged locally into an SQLite database (`simple_agent_data.db`). Here is what each column represents to an Intrusion Detection AI:

| Column | Explanation | IDS Significance |
|---|---|---|
| `Time Logged` | The exact timestamp the connection was captured. | Tracks timing patterns (e.g. burst requests over milliseconds implying DDoS, or strange 3 AM exfiltration). |
| `local_ip_hash` | SHA-256 hash of your computer's local IP address. | Maps internal traffic without exposing local networking structures or PII. |
| `local_port` | The local "door" assigned by your operating system. | Identifies which internal route opened the traffic. |
| `remote_ip_hash` | SHA-256 hash of the external/target computer's IP. | **Critical for ML:** Detects repetitive behavioral attacks (port scanning, brute-forcing, sustained connections) from a single anonymous identity. |
| `remote_port` | The port you are communicating with on the target server. | Web traffic uses Port 443. Unusual ports (like 3389 RDP or 21 FTP) suggest remote attackers or unauthorized file transfers. |
| `status` | The state of the TCP Socket (e.g., `ESTABLISHED`, `LISTEN`). | Sudden spikes in `TIME_WAIT` can signal resource exhaustion attacks. `LISTEN` spots dormant Trojan backdoors. |

---

## 🚀 How to Run It

### Prerequisites
You need Python installed. Run the following command in your terminal to install the dependencies:
```powershell
pip install psutil pandas streamlit
```

### Step 1: Start the Background Agent
This needs to run actively in the background to sample the network and log to the database.
```powershell
cd Network-Agent
python simple_agent.py
```
*(Leave this terminal window open)*

### Step 2: Launch the Showcase Dashboard
Open a **second, separate terminal**, navigate to the same folder, and start the Streamlit User Interface:
```powershell
cd Network-Agent
python -m streamlit run app.py
```
This will open your browser to `http://localhost:8501` and display the live dashboard!

---

## 🔮 Future Modifications

Since this is an extensible undergraduate design, future modules could include:
1. **Live ML Anomaly Alerts**: Adding a scikit-learn model that reads the hashes and flags statistically abnormal rows in real-time.
2. **Bandwidth Physics Tracking**: Tracking the raw egress/ingress speeds of the Network Interface Cards to look for data exfiltration spikes.
3. **Automated Blocking Output**: Letting the system talk directly to the Windows Firewall to dynamically block malicious `remote_ip_hashes` once an anomaly is identified.
4. **Cloud Database Export**: Adding features to batch-export local SQLite matrices to an AWS/Azure central reporting backend.

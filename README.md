# ThreatTron: Ethical IDS Network Agent
This repository contains the data-collection node for the ThreatTron Intrusion Detection System.

### Working Brief
The **Network-Agent** operates continuously in the background to sniff malicious network connections without violating user privacy. Here is the technical workflow:

1. **Initialization:** The agent (`simple_agent.py`) requires an explicit Python flag (`CONSENT_GRANTED = True`) to pass its first ethical guardrail before compiling its background SQLite database.
2. **Polling Loop (psutil):** Every 5 seconds, it queries the underlying Operating System for all active internet sockets, capturing purely the transmission metadata (Local/Remote IPs, active Ports, and TCP State). It intentionally ignores inner payload contents (no Deep Packet Inspection).
3. **Real-time Cryptographic Anonymization:** In volatile memory, immediately after capturing an IP string, the data runs through a Salted SHA-256 algorithm (`hashlib`). The original IPs are completely destroyed, preventing personally identifiable information (PII) from ever hitting the storage disk. 
4. **Storage & Auto-Purging:** The resulting hashed metadata is structured and appended to a local SQLite matrix (`simple_agent_data.db`). A separate loop regularly checks the database and automatically purges connection records older than 24 hours to guarantee no permanent surveillance trails exist. 
5. **Showcase Visualization:** An optional Streamlit frontend (`app.py`) can be attached at runtime to visualize the anonymized matrices flowing into the database in real-time, verifying the success of all four ethical guardrails.
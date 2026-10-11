# ThreatTron Demonstration Script (3-PC live demo)

A ~10 minute walkthrough for professors and audiences who have not seen the project. One story: **three real computers report to one console, one of them starts behaving like an insider, the system scores it, and an analyst triages it to closure.**

The data is real: agents run on three PCs and send telemetry to the hosted backend. `simulate_threat.py` is kept as a fallback only.

| Service | URL |
|---|---|
| Dashboard | https://threattron.onrender.com |
| Backend API | https://threattron-itd-backend.onrender.com |
| ML API | https://ml-api-2ru4.onrender.com |

## Cast

| Role | PC | What it does |
|---|---|---|
| **Presenter console** | PC A (also a normal employee) | Runs the dashboard and acts as the "normal" user |
| **The insider** | PC B | Performs the suspicious actions live |
| **Baseline** | PC C | Idle or lightly used; shows that not every machine alerts |

---

## Part 1. Setup (day before and 1 hour before)

### 1.1 On each of the three PCs

1. Install 64-bit **Python 3.12**, then install the agent dependencies:
   ```powershell
   cd agent
   pip install -r requirements.txt
   ```
2. **Run in the foreground.** The Windows service is currently broken (see `agent/README-Collector.md`), so do not use the installer or release ZIP. Follow `README_LOCAL_TESTING.md`.
3. **Set the backend URL.** The URL change in `agent/src/sender/sender.py` may be uncommitted, and a PC that clones from GitHub would send to the old `threattron-api` address. Set it explicitly on every PC:
   ```powershell
   $env:THREATTRON_BACKEND_URL = "https://threattron-itd-backend.onrender.com/events/batch"
   ```
4. **Limit what is monitored.** The default is `C:\Users`, which floods the backend and makes normal PCs look suspicious. Create `agent/src/config/monitor_config.json`:
   ```json
   { "thread_pool_size": 3, "monitored_directories": ["C:\\Demo"] }
   ```
   and create the `C:\Demo` folder. (Alternatively set `THREATTRON_MONITOR_CONFIG` to another path.)
5. **Check the system clock and timezone** are correct. Agents send UTC timestamps and the dashboard's time ranges depend on them.
6. Start the agent: `cd agent\src` then `python main.py`. You should see `Sent 200` repeating every ~10 seconds.

### 1.2 Record each PC's agent ID

Agent IDs are hashes (`agent-3fa9…`), not names. On the dashboard, open **Overview → Activity & agents** and note which ID belongs to which PC (the hostnames are in the telemetry). Write them on a card:

```
PC A (normal)   : agent-________________
PC B (insider)  : agent-________________
PC C (baseline) : agent-________________
```

### 1.3 Wake the services (15 minutes before)

Render free services sleep and take 30 to 60 seconds to wake.
- Open the dashboard.
- Visit `https://threattron-itd-backend.onrender.com/` and `https://ml-api-2ru4.onrender.com/openapi.json` in other tabs.
- Keep one dashboard tab open (it pings both services every 10 minutes).

### 1.4 Prepare three gauges

Alerts are only created while the **ML / Insights** page is scoring, and it scores the agent in the top-bar **Agent** filter (or "Global" if empty). To show all three PCs at once:

- Open three browser windows or tabs on `/ml`.
- In each, type one agent ID from your card into the top-bar **Agent** filter.
- Tile them side by side, labelled A, B, C.

Do not leave a tab on "Global" during the attack. Global blends all three PCs and any alert it creates would not belong to PC B.

### 1.5 Rehearse (mandatory, 45 to 60 minutes before)

Let all three agents run for **at least 30 minutes**, then check each gauge.

- Normal PCs should be green or low. If they are not, the likely cause is the backend's proxy features: system samples count as "logons" and "after-hours" means UTC hour ≤ 6 or ≥ 19, so a morning demo in India may raise every PC's score. Fix this by adjusting your demo time or monitored folder, or by switching to the fallback in Part 4.
- Perform your full insider routine on PC B once (Section 3) and confirm the gauge reaches red and an alert appears. If not, increase the number of archives until it does.
- After the rehearsal, set the alert to **Resolved** or **False positive** so the audience starts from a clean queue, and note that a repeat of the same behavior may update the existing alert rather than create a new one.

### 1.6 Other prep

- Sign in as an administrator on PC A and keep the session open.
- Screenshots of the Alerts page and a red gauge, as a last-resort fallback.
- A real USB drive for PC B.

---

## Part 2. Live script

### 2.1 Opening, 1 minute (talk, no screen)

> "Insider threats are employees or contractors who misuse legitimate access. Firewalls do not stop them because they are already inside. ThreatTron watches endpoint behavior, scores it with machine learning plus explicit rules, and gives a security analyst a place to review and close each case."

Three points:
- **Collect:** a lightweight agent on each endpoint records file, process, USB, network and system activity.
- **Detect:** four ML models plus seven behavioral rules produce one risk score.
- **Respond:** alerts become investigations with notes and an audit trail.

One line for the pipeline: `Agents → Backend API → Database → ML API → Dashboard`.

### 2.2 Calm state: three machines, one console, 2 minutes

Screen: **Overview**.

- "Three real computers in this room are reporting right now." Point at the **agents table** (three rows, last-seen times) and the **event volume sparkline**.
- Switch the **time range** from 24h to 1h to show the data is live.
- Use the **Agent** filter to narrow to PC A, then clear it.

Open **Telemetry → Processes** or **Network**.
- "This is the raw evidence collected on these machines. Network addresses are SHA-256 hashed and no payloads are captured, so it is privacy-conscious by design."

Show the three tiled gauges, all green: *"Each tile is scoring one computer."*

### 2.3 The attack, 3 minutes (main event)

Briefly explain the four model bars (LightGBM, Random Forest, Logistic Regression, Isolation Forest). Say what Isolation Forest adds: "it flags deviations from baseline even when no named rule fired."

Then, on **PC B**, in view of the audience, perform your rehearsed routine, for example:
1. Plug in the USB drive.
2. Create and copy many `.zip` files (a script that makes 50 to 60 archives in `C:\Demo` is fine) to simulate staging data.
3. Launch an unusual process from a temp folder.

Narrate: "This is the classic pattern: removable media, bulk compression of files, then an unusual process."

Wait 5 to 10 seconds and watch the **PC B gauge climb into red (CRITICAL)** while A and C stay green.

Point out, in order:
- the risk score and trend arrow,
- **Rules triggered** (for example `USB_FILE_EXFIL`, `SUSPICIOUS_FILE_TYPES`, `FULL_KILL_CHAIN`),
- the model bars: ML and rules agree.

Key line: *"The score is not a black box. Every rule that fired is named, so an analyst can see why. And the other two machines stayed green."*

Optional, 30 seconds: **Testing Sandbox** on the same page. Click the Normal, Suspicious and Critical presets and press **Run Threat Analysis** to show the model responding to any behavior profile.

### 2.4 Triage, 3 minutes

1. **Investigate → Alerts**: the new alert is at the top, with severity badge, risk bar, PC B's agent ID and evidence references.
2. Click **Investigate**. This opens a case on the **Investigations** page.
3. Walk through the details. Add a note, for example: *"USB mounted then bulk archives created. Contacting the user's manager."* Set the status to **In progress**, then **Resolved**.
4. Show the **Investigation timeline**: "Every status change and note is recorded; that is the audit trail."
5. Back on **Alerts**, mark the alert **Confirmed** (or **False positive**). Explain that analyst feedback is stored for later threshold tuning.

### 2.5 Safe practice: Workflow Sandbox, 1 minute

**Investigate → Workflow Sandbox**: "Analysts can train on simulated alerts. These records live in separate tables and never touch production data (note the SIMULATION ONLY banner)." Create one simulated event with the slider and click **Run simulation**.

### 2.6 Close, 1 minute

1. **End to end:** collection on real endpoints, storage, ML scoring and analyst workflow, all hosted.
2. **Explainable:** named rules plus per-model scores.
3. **Privacy-aware:** hashed network addresses, no content capture.

Be honest about scope (professors respect it):
- "The model was trained on the public CERT insider-threat dataset. The 99.1% figure is a consistency check against the pipeline's own labels. The stricter validation against known insiders captured 61 of 191 (about 32%). We report both."
- "The score is a decision-support signal, not proof of intent."
- "Next steps: server-side authentication on all endpoints, agent authentication on ingest, scoring on ingest independent of the UI, and a fleet-management view."

---

## Part 3. Audience-specific tweaks

| Audience | Emphasize | Trim |
|---|---|---|
| **Professors** | 2.3 (model design: 4 models + 7 rules), the honest metrics in 2.6, the research paper | 2.5 |
| **Non-technical** | The story: three computers, one goes rogue, the alert. The red gauge is the hook | Model names, rule internals |
| **Industry / SOC people** | 2.4 and 2.5 (workflow, audit trail, feedback) | Model details |
| **5-minute slot** | 2.1, 2.3 and 2.4, with agents pre-warmed | Everything else |

---

## Part 4. Fallbacks

| Problem | Fallback |
|---|---|
| Services are still asleep | Wait 30 to 60 seconds and use the retry buttons; this is why Part 1.3 exists |
| Normal PCs are not green | Present only the PC B tile and the Overview; mention that the model was calibrated on a different dataset |
| PC B's real actions do not reach red | Run `python simulate_threat.py` instead and filter the ML page to `DEMO_ATTACKER_2024`. **First change `BACKEND_URL` on line 8 to `https://threattron-itd-backend.onrender.com/events/batch`**; it still points to the old URL |
| Everything live fails | Use the Testing Sandbox presets on `/ml`, then the screenshots |
| Alerts page is empty | The ML page was not open on PC B's agent while the data arrived. Open it with the filter set, wait 10 seconds, then refresh Alerts |
| Login fails | Use the pre-signed-in session, or register a fresh admin on `/admin/sign-in` |
| An agent shows no `Sent 200` | Check `THREATTRON_BACKEND_URL`, internet access and the system clock |

## Part 5. Cleanup after the demo

- Stop the three agents (close the terminal or press Ctrl+C).
- Set any remaining alerts to **Resolved** so the next session starts clean.
- The three agent IDs stay in the database; this is expected.

---

## Likely questions

- **Why both ML and rules?** ML catches statistical oddities. Rules catch known attack chains and are explainable. The hosted risk is `0.5 × ML + 0.5 × rules`, and `is_threat` is true at 0.45.
- **What data did you train on?** The CERT insider-threat dataset (1,000 users, 35 engineered features).
- **Is 99.1% accuracy real?** It is a consistency check against the pipeline's own labels, so we do not claim it as production accuracy. The independent validation (61 of 191) is the stricter number.
- **False positives?** Analysts mark them and the feedback is stored. Alerts with the same fingerprint are deduplicated so one incident does not flood the queue.
- **Privacy?** Network IPs are hashed, no payloads are captured, and it is meant for authorized test data.
- **Does it scale?** The current deployment is single-tenant on free tiers. Multi-tenant isolation is future work.
- **What if an agent goes offline?** Events from that cycle may be lost, because the sender logs the error and does not retry that batch. Describe offline buffering as future work.

# ThreatTron ITD — Project Overview

ThreatTron is an intrusion and insider-threat detection platform. It collects security telemetry from endpoints, stores events in a backend database, turns user activity into behavioral features, scores that activity with a hybrid machine-learning and rule-based engine, and presents the results through a web dashboard.

This document is written for a reader who has not seen the project before. It describes what is implemented in this repository, how the pieces communicate, what the saved ML outputs show, and what should be verified before treating the deployment as production-ready.

## 1. What the system does

At a high level:

1. An endpoint agent observes configured file, process, system, USB, network, and email-related events.
2. The agent groups events into a session and sends batches to the backend.
3. The FastAPI backend validates and stores events in a MySQL-compatible database (the current hosted database is TiDB Cloud).
4. The ML pipeline converts activity into user-level behavioral features.
5. The ML API combines four model signals and a behavioral rule engine into a risk score.
6. The React dashboard reads the backend and ML services and gives an analyst a place to review evidence.

ThreatTron is a decision-support system. A score is an investigation signal, not proof of malicious intent and not a replacement for human review.

## 2. Current deployed services

| Component | Current URL | Technology | Purpose |
|---|---|---|---|
| Static web application | <https://threattron.onrender.com> | React, TypeScript, Vite | Dashboard and user-facing workflow |
| Backend API | <https://threattron-itd-backend.onrender.com> | FastAPI, SQLAlchemy, Gunicorn/Uvicorn | Authentication, event ingestion, event queries, alerts, investigations |
| ML API | <https://ml-api-2ru4.onrender.com> | Flask, scikit-learn, LightGBM | Risk prediction and rule-engine response |
| Database | TiDB Cloud, MySQL-compatible | SQLAlchemy + PyMySQL | Persistent telemetry and workflow data |

Render free services may sleep when unused. The first request after inactivity can therefore be slower than later requests. The frontend keep-alive code can reduce cold starts while a tab is open, but it cannot keep a service awake after all tabs are closed.

## 3. Repository map

```text
ThreatTron_ITD/
├── agent/                         Windows endpoint collection agent
│   ├── src/main.py                Foreground agent entry point
│   ├── src/collector/             File, process, system, USB, network collectors
│   ├── src/sender/                Batch sender to the backend
│   ├── Install-ThreatTronAgent.ps1  Windows service installer
│   └── package_agent.ps1           Release ZIP builder
├── backend/                       FastAPI service
│   ├── main.py                    App, ingestion, overview, ML integration
│   ├── models.py                  SQLAlchemy data model
│   ├── database.py                TiDB/MySQL connection setup
│   └── routes/                    Domain, auth, and security routes
├── frontend/                      React/Vite dashboard
│   └── src/                       Pages, API clients, shell, and shared UI
├── Behavioural-model/version_0.3/ Offline training and Flask inference service
│   ├── 01_load_and_merge.py       Source-log aggregation
│   ├── 02_feature_engineering.py  Derived ratios and intensity features
│   ├── 03_preprocess.py            Cleaning and preprocessing
│   ├── 04_train.py                 Supervised model training
│   ├── 05_evaluate.py              Model evaluation output
│   ├── 06_explain.py               Feature explanations
│   ├── 07_predict.py               Batch predictions
│   ├── 08_validate_against_observables.py  Ground-truth comparison
│   ├── 09_anomaly_detection.py     Unsupervised detection
│   ├── api.py                      Hosted /predict endpoint
│   ├── models/                     Saved model and preprocessing artifacts
│   └── results/                    Predictions, explanations, and validation
└── docs/                           Data and literature notes
```

## 4. Data flow and event model

Every agent session has a `session_id` and `agent_id`. Domain events retain those identifiers so an analyst can connect a file event, process event, USB event, network event, and system event to the same endpoint session.

The backend currently models:

- `AgentSession`: endpoint identity, hostname, start time, and session provenance.
- `FileEvent`: file path/action activity and optional extra metadata.
- `ProcessEvent`: process start/termination, executable path, parent process, and suspicious-spawn flag.
- `SystemEvent`: CPU and memory measurements.
- `USBEvent`: device activity and mount point.
- `NetworkEvent`: ports, socket status, process context, and hashed endpoint addresses.
- `EmailEvent`: sender/subject metadata and classification-related fields.
- `RiskAssessment`, `Alert`, `Investigation`, and `InvestigationNote`: derived security workflow objects.

The agent's network collector is metadata-oriented. It does not need to store packet payloads to record connection state, ports, process identity, and endpoint digests. Treat paths, subjects, process names, and timestamps as sensitive data even when network addresses are hashed.

## 5. Machine-learning model

### 5.1 Features

The saved version 0.3 pipeline produces **1,000 user rows and 35 columns** after feature engineering and preprocessing. The feature families include:

- authentication: total, after-hours, weekend, and failed logons;
- email: total messages, external messages, attachments, message volume, and recipient diversity;
- web: total HTTP activity, suspicious HTTP activity, and domain diversity;
- files: total files, executable/archive files, after-hours operations, and file ratios;
- devices: device count and device-to-action ratios; and
- combined behavioral signals: total actions, suspicious-flag ratios, exfiltration intensity, and activity intensity.

The API accepts 17 raw behavioral fields and derives the engineered values at inference time. Missing numeric fields default to zero in the API. A production client should still send an explicit, correctly named schema rather than relying on defaults.

### 5.2 Ensemble

The saved model artifacts are:

| Component | Role |
|---|---|
| LightGBM | Nonlinear supervised tabular model |
| Random Forest | Tree ensemble with a different variance/bias profile |
| Logistic regression | Lower-complexity supervised reference |
| Isolation Forest | Unsupervised deviation signal |

Each component is normalized to a comparable range. The configured offline risk score is:

```text
offline_risk = 0.5 * lightgbm
             + 0.2 * random_forest
             + 0.1 * logistic
             + 0.2 * anomaly
```

The offline threshold in `config.yaml` is `0.8`. The hosted Flask API additionally runs seven behavioral rules and blends the ML score and rule score equally:

```text
hosted_risk = 0.5 * ml_score + 0.5 * rule_score
```

The hosted API marks `is_threat=true` at `hosted_risk >= 0.45`. This is different from the offline `0.8` threshold; always state which score and threshold are being reported.

### 5.3 Rules exposed by the hosted ML API

The rule engine can fire for USB plus file activity, suspicious web plus file staging, external email plus file activity, a combined USB/web/email chain, executable/archive creation, after-hours exfiltration, and mass external-recipient activity. The response includes `rules_triggered`, `ml_score`, `rule_score`, component confidences, and the final `risk_score`.

### 5.4 Accuracy and saved results

The repository contains real, inspectable outputs under `Behavioural-model/version_0.3/results/`:

| Measurement | Value | Interpretation |
|---|---:|---|
| Users in prediction output | 1,000 | Batch output size |
| Positive labels in `predictions.csv` | 70 | Labels written by the pipeline |
| Rows with final score `>= 0.8` | 61 | High-threshold alert count |
| Prediction-label consistency check: precision | 100.0% | 61 TP, 0 FP against the CSV's own label column |
| Prediction-label consistency check: recall | 87.14% | 61 TP, 9 FN against the CSV's own label column |
| Prediction-label consistency check: F1 | 93.13% | Derived from that same label column |
| Prediction-label consistency check: accuracy | 99.1% | 991/1,000 against that same label column |
| Observable insiders in validation report | 191 | Separate stricter comparison set |
| Captured by threshold in validation report | 61 | 61/191 = 31.9% capture rate |
| Not captured in validation report | 130 | Reported false negatives under that protocol |
| Explanation rows | 1,000 | Three top feature names per user |
| `total_file` as first explanation feature | 448 | 44.8% of users |

The first group of metrics is a **consistency check against the label column already stored in `predictions.csv`**, not an independently held-out accuracy claim. The observable-validation report uses a different ground-truth procedure and should be reported separately. Do not advertise 99.1% as general production accuracy. For a publishable evaluation, use user-disjoint and time-ordered holdouts, calibration, confidence intervals, and independent labels.

## 6. Configuration and security expectations

Secrets must be supplied through environment variables or an untracked `.env` file. Never commit TiDB passwords, JWT secrets, email credentials, or private model endpoints. The backend accepts `DATABASE_URL` or separate `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, and `DB_NAME` variables. `ALLOWED_ORIGINS` must contain the deployed frontend origin. The frontend uses `VITE_API_URL` and optionally `VITE_ML_API_URL` at build time.

The current codebase is not a fully isolated multi-tenant product. It has agent/user/role concepts and filtering, but organization/campus-level tenant isolation must not be assumed without additional schema, authorization, and query-scope work. Use it only with authorized test data until that boundary has been reviewed.

The Windows background-service package is also a deployment path that must be tested on the target Windows version before distributing a release ZIP. For development, run the agent in the foreground as described in `README_LOCAL_TESTING.md`.

## 7. Quick links

- [Local testing guide](./README_LOCAL_TESTING.md)
- [Deployment and configuration guide](./README_DEPLOYMENT_CONFIGURATION.md)
- [Agent collector README](./agent/README-Collector.md)
- [Behavioral-model README](./Behavioural-model/version_0.3/README.md)
- [Architecture notes](./docs/architecture.md)
- [Data schema notes](./docs/data_schema.md)

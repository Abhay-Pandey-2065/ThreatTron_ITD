# ThreatTron ITD — Local Testing Guide

This guide starts the three application services locally and provides smoke tests for the backend, ML API, frontend, and optional endpoint agent. It assumes PowerShell on Windows, but the commands are easily adapted to Bash.

## 1. Before you start

Install:

- Git
- Python 3.11 or 3.12 for the backend and agent
- Node.js 20 or newer and npm for the frontend
- A MySQL-compatible database. The deployed system uses TiDB Cloud; for local work, use a local MySQL-compatible server or a development TiDB database.

Clone the repository and open a terminal in the repository root:

~~~powershell
git clone https://github.com/Abhay-Pandey-2065/ThreatTron_ITD.git
Set-Location ThreatTron_ITD
~~~

Do not put a real TiDB password in a committed file. Create `backend\.env` locally, or set environment variables only in the current terminal session.

## 2. Start the backend API

Create a virtual environment and install the backend dependencies:

~~~powershell
Set-Location backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
~~~

Set a database URL. The URL format is compatible with TiDB Cloud's MySQL connection details:

~~~powershell
$env:DATABASE_URL = "mysql+pymysql://DB_USER:DB_PASSWORD@DB_HOST:4000/DB_NAME?ssl-mode=REQUIRED"
$env:ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
$env:ML_API_URL = "http://127.0.0.1:10000/predict"
~~~

If you prefer individual settings, use `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, and `DB_NAME` instead of `DATABASE_URL`. The backend creates missing SQLAlchemy tables at startup; it does not migrate existing schemas.

Start FastAPI in a terminal that remains open:

~~~powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
~~~

Expected root response:

~~~powershell
Invoke-RestMethod http://127.0.0.1:8000/
~~~

The response should identify the ThreatTron backend. If startup fails, check the database URL, TiDB TLS settings, and whether the database user can create or read the required tables.

## 3. Start the ML API

Open a second terminal. The ML API must be started from its own directory because `api.py` loads `config.yaml` and relative model paths from the current working directory.

~~~powershell
Set-Location .\Behavioural-model\version_0.3
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python api.py
~~~

The service listens on the `PORT` environment variable, or port `10000` by default. For a different local port:

~~~powershell
$env:PORT = "10001"
python api.py
~~~

If model loading fails, verify that `models\feature_schema.pkl`, `scaler.pkl`, `v1_lightgbm.pkl`, `v1_rf.pkl`, `v1_logistic.pkl`, and `v1_isolation.pkl` exist. The large raw CERT dataset is needed for retraining, but it is not needed merely to serve the checked-in model artifacts.

## 4. Test the ML endpoint directly

In a third terminal, send a small synthetic request. This is a smoke test, not an accuracy test:

~~~powershell
$payload = @{
  user_id = "local-smoke-test"
  total_logons = 20
  after_hours_logons = 2
  weekend_logons = 1
  failed_logons = 1
  total_emails = 30
  emails_with_attachments = 4
  external_emails = 3
  total_email_megabytes = 12
  total_http = 50
  suspicious_http = 2
  total_file = 40
  exe_zip_files = 2
  after_hours_file_ops = 3
  total_device = 1
  num_distinct_pcs = 2
  unique_http_domains = 10
  unique_external_recipients = 3
} | ConvertTo-Json -Depth 4

Invoke-RestMethod -Method Post -Uri http://127.0.0.1:10000/predict -ContentType "application/json" -Body $payload
~~~

The response should contain `risk_score`, `is_threat`, `ml_score`, `rule_score`, `rules_triggered`, and `sub_scores`. A non-empty `rules_triggered` list is expected when the sample satisfies one of the behavioral rules.

## 5. Start the frontend

Open a fourth terminal:

~~~powershell
Set-Location .\frontend
Copy-Item .env.example .env -ErrorAction SilentlyContinue
~~~

If `.env.example` is not present, create `frontend\.env` with:

~~~text
VITE_API_URL=http://127.0.0.1:8000
VITE_ML_API_URL=http://127.0.0.1:10000
~~~

Install and run the Vite development server:

~~~powershell
npm install
npm run dev
~~~

Open the URL printed by Vite, normally <http://localhost:5173>. Vite variables are read at build/start time; restart the dev server after editing `.env`.

Useful frontend checks:

~~~powershell
npm run build
npm run lint
~~~

The build command runs TypeScript compilation and creates the production bundle in `frontend\dist`.

## 6. Test backend event routes

First confirm the database is reachable:

~~~powershell
Invoke-RestMethod "http://127.0.0.1:8000/api/overview/stats?time_range=24h"
~~~

The response contains `total_events`, counts by event type, and `active_agents`. With an empty database, zero counts are normal.

The agent's legacy ingestion endpoint is `POST /events/batch`. A minimal session-start request is:

~~~powershell
$event = @{
  events = @(@{
    event_type = "session_started"
    agent_id = "local-test-agent"
    session_id = "00000000-0000-0000-0000-000000000001"
    timestamp = (Get-Date).ToUniversalTime().ToString("o")
    metadata = @{ hostname = $env:COMPUTERNAME }
  })
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/events/batch -ContentType "application/json" -Body $event
~~~

Then query the overview again and confirm that the service remains healthy. Use test identifiers and synthetic records during development.

## 7. Run the endpoint agent in the foreground

The agent is Windows-oriented and requires permission to observe configured folders, processes, devices, and network state. For a local test, use the foreground entry point instead of installing a Windows service:

~~~powershell
Set-Location .\agent
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item config\monitor_config.example.json config\monitor_config.json
~~~

Edit `agent\config\monitor_config.json` so `monitored_directories` contains only a test folder that you are authorized to monitor. Set the backend endpoint for the current PowerShell session:

~~~powershell
$env:THREATTRON_BACKEND_URL = "http://127.0.0.1:8000/events/batch"
python src\main.py
~~~

Create a harmless file in the monitored test folder and inspect `/api/overview/stats` or the relevant event route. Stop the foreground process with `Ctrl+C`.

The Windows service installer and ZIP packaging scripts exist under `agent`, but the service path should be validated on the target Windows version before distribution. Do not use a ZIP as evidence that the background service is working; the foreground smoke test and the Windows Services/Event Viewer checks are separate tests.

## 8. Retrain or inspect the offline ML pipeline

The model pipeline is under `Behavioural-model\version_0.3`. Update the paths in `config.yaml` to point to an authorized copy of the CERT r4.2 data and answer files. The scripts are intended to run in order:

~~~powershell
Set-Location .\Behavioural-model\version_0.3
python 01_load_and_merge.py
python 02_feature_engineering.py
python 03_preprocess.py
python 04_train.py
python 05_evaluate.py
python 09_anomaly_detection.py
python 07_predict.py
python 06_explain.py
python 08_validate_against_observables.py
~~~

Keep the generated `models`, `data`, and `results` directories tied to the same configuration and code revision. Do not call the prediction-label consistency check an independent test-set accuracy unless the labels and split procedure are independently documented.

## 9. Common problems

| Symptom | Checks |
|---|---|
| Backend cannot connect | `DATABASE_URL`, TiDB host/port, TLS query, credentials, firewall |
| Frontend shows “API not available” | backend is running, `VITE_API_URL` is correct, `ALLOWED_ORIGINS` includes the frontend origin |
| ML API cannot load models | run from `Behavioural-model/version_0.3`; verify all `.pkl` files and `config.yaml` |
| Render URL is slow initially | free-service cold start; wait and retry once |
| No agent events | endpoint URL, session start, test folder permissions, agent logs, and database counts |
| Service does not start | test `python src/main.py` first; inspect Windows Event Viewer and service configuration |


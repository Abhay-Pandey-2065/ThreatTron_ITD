# ThreatTron ITD — Deployment and Configuration

This file records the current hosted topology and the configuration needed to reproduce it. It is intended for maintainers who need to deploy, rotate credentials, or troubleshoot the public application.

## 1. Production topology

~~~text
Browser
  |
  v
Render Static Site: https://threattron.onrender.com
  |  VITE_API_URL
  v
Render Web Service: https://threattron-itd-backend.onrender.com
  |  DATABASE_URL / MySQL TLS
  v
TiDB Cloud: ThreattronDB (MySQL-compatible)

Backend /api/sandbox and ML integrations
  |
  v
Render Web Service: https://ml-api-2ru4.onrender.com
~~~

The frontend is a static Vite build. The backend is a FastAPI application. The ML service is a separate Flask application that loads the checked-in model artifacts at process startup. TiDB Cloud is the persistent database for backend events and security workflow records.

## 2. TiDB Cloud configuration

The current TiDB Cloud instance shown in the deployment setup is:

| Setting | Current value |
|---|---|
| Database name | ThreattronDB |
| Compatibility | MySQL-compatible |
| Plan shown | Starter |
| Cloud provider | AWS |
| Region shown | Tokyo (ap-northeast-1) |
| High availability shown | Zonal |

Use the TiDB Cloud connection details panel to obtain the actual username, password, host, port, and database name. Do not copy credentials into this README, Git, screenshots, Render logs, or frontend variables.

### Backend database variables

Preferred form:

~~~text
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:4000/DATABASE?ssl-mode=REQUIRED
~~~

The backend also supports:

~~~text
DB_USER=...
DB_PASSWORD=...
DB_HOST=...
DB_PORT=4000
DB_NAME=ThreattronDB
~~~

backend/database.py converts a mysql:// driver to mysql+pymysql:// and handles the ssl-mode query. TiDB TLS should remain enabled for hosted traffic. At backend startup, SQLAlchemy create_all creates missing tables; it is not a versioned migration system. Back up the database before schema changes.

## 3. Render static frontend

### Service purpose

The static site is the React dashboard at:

<https://threattron.onrender.com>

### Repository and branch

- Repository: Abhay-Pandey-2065/ThreatTron_ITD
- Branch: main
- Root directory: frontend/

### Build configuration

Use:

~~~text
Build command: npm install && npm run build
Publish directory: frontend/dist
~~~

If Render interprets the root directory as frontend/, use npm install && npm run build and publish dist instead. The important requirement is that the publish directory contains the Vite-generated index.html.

### Frontend environment variables

Set these in Render before building:

~~~text
VITE_API_URL=https://threattron-itd-backend.onrender.com
VITE_ML_API_URL=https://ml-api-2ru4.onrender.com
~~~

Vite injects VITE_* values at build time. Changing them requires a new frontend build/deploy. Never put a database password or private backend secret in a VITE_* variable; all Vite variables are visible to browser users.

### SPA routing

The application uses client-side routes such as /overview, /ml, /alerts, and /investigations. Configure Render's static-site rewrite so unknown paths serve index.html; otherwise refreshing a deep link can return a 404 even though navigation inside the app works.

## 4. Render backend API

### Service purpose

The FastAPI service is:

<https://threattron-itd-backend.onrender.com>

It provides authentication, event ingestion, domain event routes, overview statistics, security workflow routes, and the /api/sandbox proxy.

### Render settings

The deployment screenshots show:

~~~text
Repository: Abhay-Pandey-2065/ThreatTron_ITD
Branch: main
Root directory: backend/
Build command: pip install -r requirements.txt
Start command: gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app
Auto-deploy: On Commit
~~~

The repository also contains a backend/Procfile with a four-worker command. Keep the Render dashboard command and the repository Procfile consistent; do not assume both are active simultaneously. One worker is a conservative choice for a small/free service and four workers can increase memory usage.

### Backend environment variables

Set at minimum:

~~~text
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:4000/ThreattronDB?ssl-mode=REQUIRED
ALLOWED_ORIGINS=https://threattron.onrender.com
ML_API_URL=https://ml-api-2ru4.onrender.com/predict
~~~

For local development, include http://localhost:5173,http://127.0.0.1:5173 in ALLOWED_ORIGINS. Additional optional integrations in the code include THREATTRON_EMAIL_ML_URL for the email-classification service.

Do not place DATABASE_URL in frontend code. Render environment variables should be marked secret where the platform permits it, and logs should be checked for accidental credential output.

### Backend smoke checks

~~~powershell
Invoke-RestMethod https://threattron-itd-backend.onrender.com/
Invoke-RestMethod "https://threattron-itd-backend.onrender.com/api/overview/stats?time_range=24h"
~~~

An empty database can correctly return zero events. A server error means inspect Render deploy logs, database connectivity, CORS, and table creation.

## 5. Render ML API

### Service purpose

The Flask service is:

<https://ml-api-2ru4.onrender.com>

It loads config.yaml, the feature schema, scaler, and four model files from models/ and exposes POST /predict.

### Render settings

The deployment screenshots show:

~~~text
Repository: Abhay-Pandey-2065/ThreatTron_ITD
Branch: main
Root directory: Behavioural-model/version_0.3
Build command: pip install Flask pandas numpy lightgbm scikit-learn shap pyyaml joblib matplotlib
Start command: gunicorn api:app
Auto-deploy: On Commit
~~~

Using pip install -r requirements.txt is easier to maintain and should install the same declared dependencies. Render supplies PORT; api.py uses it when run directly, while Gunicorn binds according to its platform configuration.

### Required files

The ML root directory must contain:

~~~text
api.py
config.yaml
requirements.txt
models/feature_schema.pkl
models/scaler.pkl
models/v1_lightgbm.pkl
models/v1_rf.pkl
models/v1_logistic.pkl
models/v1_isolation.pkl
~~~

The raw CERT dataset paths in config.yaml are used by the offline training scripts, not by normal API startup. Hosted inference still requires the saved model artifacts and schema.

### ML smoke check

~~~powershell
$payload = '{"user_id":"render-smoke-test","total_logons":1,"total_emails":1,"total_http":1,"total_file":1,"total_device":0}'
Invoke-RestMethod -Method Post -Uri https://ml-api-2ru4.onrender.com/predict -ContentType "application/json" -Body $payload
~~~

A successful response contains status: "success", a final risk_score, is_threat, ML and rule scores, rules_triggered, and component sub-scores.

## 6. Service-to-service configuration

The browser calls the backend using VITE_API_URL. The backend calls the ML API using ML_API_URL, and the /api/sandbox route currently proxies to the ML URL in code. The backend must allow the deployed frontend origin through ALLOWED_ORIGINS.

The data agent does not use the frontend URL. Its installer asks for an HTTPS backend base address and appends /events/batch. For the hosted system, provide:

~~~text
https://threattron-itd-backend.onrender.com
~~~

Do not provide /events/batch to the installer if it explicitly asks for the base address; the installer appends that path itself.

## 7. Deployment order

1. Create or verify TiDB Cloud and test the MySQL TLS connection.
2. Deploy the ML service and confirm POST /predict.
3. Deploy the backend with DATABASE_URL, ALLOWED_ORIGINS, and ML_API_URL.
4. Confirm the backend root and overview endpoint.
5. Deploy the frontend with the two VITE_* URLs.
6. Open the static site and check the browser network tab for backend CORS or URL errors.
7. Run a synthetic ML request and, separately, a synthetic /events/batch session request.
8. Test the endpoint agent only on an authorized machine and with a test folder.

Render's auto-deploy-on-commit setting means a push to main can redeploy multiple services. Check each service's build and runtime logs after a change to shared backend or model files.

## 8. Configuration boundaries and current status

- The database is MySQL-compatible TiDB Cloud, not a local SQLite backend.
- The frontend is a public static bundle; no secret belongs in its environment variables.
- The ML API has a separate offline threshold (0.8) and hosted blended threshold (0.45); report the correct one.
- The current schema does not provide complete organization/campus tenant isolation. Do not market the deployment as a fully isolated multi-tenant system without implementing and testing organization-scoped authorization and query filters.
- The Windows service path should be verified independently from the foreground agent. Do not distribute a release ZIP as a guarantee that the background service works.
- Render free-tier sleep/cold-start behavior is expected and is not equivalent to an application error.

## 9. Credential rotation and incident response

If a credential appears in a commit, screenshot, terminal history, or log:

1. Rotate it in TiDB Cloud or Render immediately.
2. Remove it from the repository and future logs.
3. Review database and Render access logs.
4. Rebuild/redeploy affected services.
5. Check the agent and backend endpoints after rotation.

Keep backups and deployment settings documented separately from secrets.

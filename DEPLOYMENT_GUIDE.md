# ThreatTron Deployment Guide: Render + Railway

## Architecture Overview

```
┌─────────────────────┐
│  Agent (Windows)    │
│  - Collector        │
│  - Monitors         │
└────────┬────────────┘
         │ HTTP POST
         │ /events/batch
         ▼
┌─────────────────────┐
│  Backend API        │
│  (Render)           │
└────────┬────────────┘
         │ SQL queries
         ▼
┌─────────────────────┐
│  MySQL Database     │
│  (Railway)          │
└─────────────────────┘
         ▲
         │ HTTP GET
         │ queries
         │
┌────────┴────────────┐
│  Frontend           │
│  (Local or Cloud)   │
└─────────────────────┘
```

## Step 1: Get Railway MySQL Connection String

You already deployed MySQL on Railway. Get the connection details:

1. Go to [railway.app](https://railway.app)
2. Open your MySQL database
3. Click "Connect" → "MySQL Connection String"
4. Copy the URL (format: `mysql+pymysql://user:password@gateway.railway.app:3306/railway`)
5. **Save this** - you'll need it for Render

## Step 2: Deploy Backend API to Render

### 2.1 Prepare GitHub

Render deploys directly from GitHub. Make sure your code is pushed:

```bash
cd d:\Personal_Projects\ThreatTron_ITD
git add -A
git commit -m "Prepare backend for Render deployment"
git push origin main
```

### 2.2 Create Render Account & Deploy

1. Go to [render.com](https://render.com) and sign up (free tier available)
2. Click **"New +"** → **"Web Service"**
3. Select your GitHub repository
4. Choose the **`backend`** directory as root
5. Configure:
   - **Name**: `threattron-api`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app`
   - **Plan**: Free tier (good for dev/testing)

6. Click **"Advanced"** and add **Environment Variables**:

```
DB_USER=<from Railway>
DB_PASSWORD=<from Railway>
DB_HOST=<from Railway MySQL, e.g., gateway.railway.app>
DB_PORT=3306
DB_NAME=<database name from Railway>
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**OR use the full DATABASE_URL:**

```
DATABASE_URL=mysql+pymysql://user:password@gateway.railway.app:3306/railway
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

7. Click **"Create Web Service"**
8. Wait for deployment (2-3 minutes)
9. **Copy the URL** when done (e.g., `https://threattron-api.onrender.com`)

## Step 3: Update Agent to Use Render Backend

The agent's `sender.py` already supports environment variables. Now you need to change the backend URL.

### 3.1 Option A: Environment Variable (Recommended for dynamic changes)

Set on your Windows machine (permanently):

**PowerShell (Admin):**
```powershell
[Environment]::SetEnvironmentVariable("THREATTRON_BACKEND_URL", "https://threattron-api.onrender.com/events/batch", "User")
```

**Or in agent/.env:**
```
THREATTRON_BACKEND_URL=https://threattron-api.onrender.com/events/batch
```

### 3.2 Option B: Direct Code Change

Edit `agent/src/sender/sender.py`:

```python
import os, requests

BACKEND_URL = os.environ.get(
    "THREATTRON_BACKEND_URL", 
    "https://threattron-api.onrender.com/events/batch"  # Change from localhost
)

def send_events(events):
    try:
        response = requests.post(BACKEND_URL, json={"events": events}, timeout=10)
        print(f"Sent {response.status_code}")
    except Exception as e:
        print(f"Error sending events: {e}")
```

## Step 4: Update Frontend (Optional - if hosting on Render too)

If you deploy the frontend to Render, update the CORS variable:

1. Get your frontend Render URL (e.g., `https://threattron-frontend.onrender.com`)
2. Update the backend environment variable:

```
ALLOWED_ORIGINS=https://threattron-frontend.onrender.com,http://localhost:5173
```

For now, keep it local and pointing to `localhost:5173`.

## Step 5: Test the Connection

### 5.1 Check if Backend is Running

```bash
curl https://threattron-api.onrender.com/
```

Should return:
```json
{"message": "ThreatTron Backend Running (MySQL)"}
```

### 5.2 Check if Agent Can Connect

Run your agent and check the logs for:
```
Sent 200
```

If you see `200`, data is being received! ✅

### 5.3 Check Database

Go to Render dashboard → open backend service → **Logs** tab.
Look for any database connection errors.

## Step 6: Verify Data Flow

1. **Run Agent** on Windows
2. **Open Frontend** at `http://localhost:5173`
3. Check **Overview** → **Stats** tab
4. Should see events from your agent ✅

---

## Environment Variables Summary

### Backend (.env or Render)

| Variable | Value | Example |
|----------|-------|---------|
| `DATABASE_URL` | Full MySQL connection | `mysql+pymysql://user:pass@gateway.railway.app:3306/railway` |
| `ALLOWED_ORIGINS` | Comma-separated origins | `http://localhost:5173,https://frontend.onrender.com` |
| `DB_USER` | MySQL user | `root` |
| `DB_PASSWORD` | MySQL password | (from Railway) |
| `DB_HOST` | MySQL host | `gateway.railway.app` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | Database name | `railway` |

### Agent (.env or Windows Environment)

| Variable | Value | Example |
|----------|-------|---------|
| `THREATTRON_BACKEND_URL` | Backend API endpoint | `https://threattron-api.onrender.com/events/batch` |
| `THREATTRON_EMAIL_ENABLED` | Enable email monitoring | `false` or `true` |

---

## Troubleshooting

### ❌ Agent sends "Error connecting to backend"

**Solution:**
1. Check Render backend is running: `curl https://threattron-api.onrender.com/`
2. Check `THREATTRON_BACKEND_URL` environment variable
3. Check Render logs: Dashboard → Backend service → Logs

### ❌ "Database connection failed"

**Solution:**
1. Verify Railway MySQL is running
2. Check `DATABASE_URL` or individual DB credentials
3. Check Render logs for connection string errors
4. Verify IP allowlisting in Railway (usually allows all)

### ❌ CORS errors in frontend

**Solution:**
1. Update `ALLOWED_ORIGINS` on Render to include frontend domain
2. Redeploy or restart backend service
3. Clear browser cache (Ctrl+Shift+Delete)

### ❌ No data appearing in frontend

**Solution:**
1. Check if agent is running
2. Check agent logs for "Sent 200"
3. Check Render logs for POST requests
4. Query database directly via Railway to verify data exists

---

## Next Steps

1. ✅ Backend deployed on Render
2. ✅ Agent pointing to Render backend
3. ⏭️ Deploy frontend to Cloud (optional)
4. ⏭️ Package agent as Windows EXE/Service (next phase)

---

## Useful Commands

**Test backend connectivity:**
```bash
curl https://threattron-api.onrender.com/api/overview/stats?time_range=24h
```

**Check agent logs:**
```bash
# In agent folder
python src/main.py
```

**Restart Render service:**
Go to Render dashboard → Backend service → Manual Deploy


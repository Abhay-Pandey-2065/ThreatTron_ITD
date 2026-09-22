# ThreatTron Configuration Guide

This guide records the configuration needed to run the ThreatTron backend with a remote MySQL database. It covers Render, MySQL Workbench, and the related codebase configuration.

## 1. Render Backend Configuration

Render hosts the FastAPI backend and provides the public API URL.

### Service settings

Use the following settings for the Render web service:

| Setting | Value |
|---|---|
| Repository | GitHub ThreatTron project |
| Branch | `main` |
| Runtime | Python 3 |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app` |

The root directory must be `backend` because `main.py`, `database.py`, `models.py`, `routes/`, and `requirements.txt` are inside that directory.

### Environment variables

The main Render variable is:

```text
DATABASE_URL
```

Use this format:

```text
mysql+pymysql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
```

Important points:

- Use `mysql+pymysql`, not only `mysql`.
- Use the current database endpoint as `HOST`.
- Use the database provider's current port.
- Use a database name that already exists.
- Do not include unsupported parameters such as `ssl-mode=REQUIRED` unless the code explicitly supports them.
- Do not include spaces, quotes, or line breaks in the URL.
- Do not put `DATABASE_URL=` inside the value field.
- If the password contains URL-sensitive characters, encode them or use separate database variables locally.

Also configure:

```text
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

If the frontend is deployed, include its URL as another comma-separated origin:

```text
ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.onrender.com
```

The backend code gives `DATABASE_URL` priority over individual `DB_*` variables. Remove obsolete database variables from Render to avoid confusion.

### Deployment process

After changing Render configuration:

1. Save the environment variables.
2. Use **Manual Deploy**.
3. Deploy the latest commit.
4. Use **Clear build cache & deploy** if dependency changes are not detected.
5. Check build logs and runtime logs separately.

### API verification

Test the root endpoint:

```text
https://YOUR-RENDER-URL/
```

Expected response:

```json
{
  "message": "ThreatTron Backend Running (MySQL)"
}
```

Then test an overview endpoint:

```text
https://YOUR-RENDER-URL/api/overview/stats?time_range=24h
```

### Render troubleshooting reminders

- `No module named 'main'` usually means the Root Directory is wrong.
- `python-multipart` errors usually mean dependencies were not installed from `requirements.txt`.
- `MySQLdb` errors usually mean the URL begins with `mysql://` instead of `mysql+pymysql://`.
- `Unknown database` means the final database name in the URL does not exist.
- `Access denied` usually means the database user does not have access to the selected database.
- `Name or service not known` usually means the database hostname is incorrect or unavailable.
- A long deployment can be caused by queued builds, dependency installation, database connectivity, or a stale build cache.

## 2. MySQL Workbench Configuration

MySQL Workbench is a client tool for accessing and managing the remote MySQL database. It does not host the database, so Workbench and the local computer do not need to remain running after setup.

### Workbench connection values

Use:

| Field | Value |
|---|---|
| Connection name | Any descriptive name |
| Connection method | Standard TCP/IP |
| Hostname | The remote database endpoint |
| Port | The remote database port |
| Username | The database master or application user |
| Password | The database password |
| Default schema | Optional; leave blank initially |

Do not use `localhost` unless the database is running on the local computer. A remote database requires its provider endpoint.

### Creating the application database

After connecting, create a dedicated database for the project:

```sql
CREATE DATABASE threattron_itd;
```

Verify it:

```sql
SHOW DATABASES;
```

The database name in Workbench must match the database name at the end of Render's `DATABASE_URL`:

```text
Workbench database: threattron_itd
DATABASE_URL ending: /threattron_itd
```

### Network access

The remote database must allow MySQL traffic from:

- The computer running MySQL Workbench
- Render, which runs the deployed backend

The database security group or firewall must allow the configured MySQL port. Broad access can be used temporarily for testing, but a restricted IP-based rule is safer. Do not leave a production database open to the entire internet.

## 3. Codebase Configuration

No major code change is required when moving between compatible MySQL providers. The backend already supports SQLAlchemy with PyMySQL.

### Database loading behavior

[`backend/database.py`](backend/database.py) loads environment values and supports `DATABASE_URL`.

The code uses this general fallback format when individual variables are used:

```text
mysql+pymysql://...
```

Therefore, a Render URL must use the PyMySQL driver:

```text
mysql+pymysql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME
```

### Database initialization

[`backend/main.py`](backend/main.py) runs table creation during startup:

```python
Base.metadata.create_all(bind=engine)
```

This means:

- The database itself must already exist.
- The database user must have permission to create tables.
- Render must be able to connect to the database before the API can start.
- Once connected, SQLAlchemy creates the project tables automatically.

### Dependencies

[`backend/requirements.txt`](backend/requirements.txt) contains the backend dependencies, including:

- FastAPI
- Uvicorn
- Gunicorn
- SQLAlchemy
- PyMySQL
- `python-dotenv`
- `python-multipart`
- `email-validator`
- `bcrypt`
- HTTP and request libraries

Render should install them with:

```text
pip install -r requirements.txt
```

### Environment file reminder

For local development, private values may be stored in:

```text
backend/.env
```

For Render:

- Do not upload `.env`.
- Add secrets in Render's Environment Variables section.
- Keep `.env` out of Git.
- Keep `.env.example` as a template containing placeholders only.
- Never commit database passwords or complete connection URLs.

## 4. Security and Cost Reminders

- Rotate any password exposed in screenshots, logs, or messages.
- Never share a complete `DATABASE_URL`.
- Do not commit `.env`.
- Do not put real passwords in `.env.example`.
- Use separate credentials for development and deployment when possible.
- Restrict database firewall rules instead of using open access permanently.
- Set a cloud billing budget or alert when using a paid database service.
- Delete unused database instances and services to avoid unexpected charges.
- Keep a backup of database configuration, but not the password in plain text.

## 5. Repeatable Checklist

### Database

- Create a remote MySQL instance.
- Confirm that it is available.
- Copy the endpoint and port.
- Create the application database/schema.
- Configure inbound access.
- Test the connection in MySQL Workbench.

### Codebase

- Confirm `backend/main.py` exists.
- Confirm `backend/requirements.txt` exists.
- Confirm the database driver is PyMySQL.
- Confirm `.env` is ignored by Git.
- Do not store production credentials in the repository.

### Render

- Set Root Directory to `backend`.
- Use `pip install -r requirements.txt`.
- Use the Gunicorn/Uvicorn start command.
- Add a valid `DATABASE_URL`.
- Add `ALLOWED_ORIGINS`.
- Deploy and check logs.
- Test `/` and `/api/overview/stats`.

The main relationship is:

```text
MySQL Workbench -> verifies and manages the database
Render -> runs the backend API
Codebase -> reads DATABASE_URL and creates/uses database tables
```

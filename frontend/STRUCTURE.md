# ThreatTron frontend — layout and routing

## Product stance (implemented in this app)

- **Single app** under `frontend/`.
- **Signed-in** for the console; **User** vs **Administrator** portals and roles (`AdminRoute` for `/admin`).
- **ML first-class:** Overview includes an **ML summary strip** + link to **`/ml`**; full insights page at **`/ml`** (placeholders until APIs exist).

## Role model

- **`user`** — full nav except **Admin**.
- **`admin`** — same + **Admin** home at `/admin`.

## Public routes

| Path | Purpose |
|------|---------|
| `/` | Landing (signed-in users redirect to `/overview`) |
| `/user` | User sign-in / sign-up / session |
| `/admin/sign-in` | Administrator sign-in / sign-up / session |
| `/forgot-password?portal=user\|admin` | Forgot password (UI + copy for future API) |
| `/reset-password?portal=…&token=…` | Reset password (UI stub) |
| `/403` | Forbidden |

## Protected routes (inside `AppShell`)

**Shell:** left sidebar (Overview, Files, Processes, System, Email, USB, Network, ML / Insights, Admin†), top bar (**time range**, **agent** filter, **user menu**), footer (version + privacy note).

† Admin link only if `role === 'admin'`.

| Path | Notes |
|------|--------|
| `/overview` | Dashboard: KPI placeholders, **ML strip**, chart/feed placeholders |
| `/files` … `/network` | Domain placeholders (wire APIs later) |
| `/ml` | ML / Insights page (structure + empty states) |
| `/admin` | Admin home (placeholder); sub-routes later |

Guests hitting protected URLs → `/user` with `state.from`.

## Authentication extras

- **User menu** (top right): Session & account, Forgot password, Sign out.
- **JWT-ready helpers:** `src/lib/apiToken.ts` — `getAccessToken`, `setAccessToken`, `clearAccessToken`, `authHeaders()`. Cleared on **logout**. Demo login does not set a token; wire after `POST /auth/login`.
- **Sign-in forms:** links to **Forgot password** and **Reset with token**.

## Folder map (high level)

```
src/
  app/           App.tsx, providers
  auth/          portals, provider, storage, guards
  features/
    overview/    OverviewKPIRow, OverviewMLSummary, charts/feed placeholders
  layout/        AppShell, ShellFiltersProvider, UserMenu, shell-filters-context
  lib/           apiToken.ts
  pages/         Landing, ML, Forgot/Reset, domain placeholders, …
  styles/        app.css
```

## Local storage keys

- `threattron_auth` — session
- `threattron_registered_users` — demo registrations `{ email, password, role }`
- `threattron_access_token` — optional JWT for API calls (when set)

# ThreatTron frontend

React + TypeScript + Vite. All UI work for this project lives in this folder.

See **[STRUCTURE.md](./STRUCTURE.md)** for routes, roles, shell layout, and folders.

## Prerequisites

- Node.js 20+ (recommended)

## Setup

```bash
cd frontend
npm install
```

Copy `.env.example` to `.env` and set `VITE_API_URL` to your FastAPI base URL (default `http://127.0.0.1:8000`).

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start dev server (Vite HMR) |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint |

## Stack

- [Vite](https://vite.dev/)
- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [React Router](https://reactrouter.com/)

## Product stance & auth (this build)

- **Overview** lives at **`/overview`** (dashboard with KPI + **ML summary** + placeholders). Signed-in users opening **`/`** are redirected here.
- **ML / Insights** at **`/ml`** — full page scaffold; hook to `GET /ml/insights` etc. when ready.
- **Shell:** sidebar (all primary sections + ML), **global time range** + **agent** filter, **user menu** (session, forgot password, sign out), **footer** (version from `package.json` + privacy note).
- **Portals:** `/user` and `/admin/sign-in` for role-scoped sign-in / sign-up.
- **Forgot / reset:** `/forgot-password`, `/reset-password` — UI ready for backend mail + token validation.
- **API JWT:** use `src/lib/apiToken.ts` after real login; cleared on logout.

## Registration (demo)

Local `localStorage` only. Minimum password length: 8. Reserved demo emails cannot be registered.

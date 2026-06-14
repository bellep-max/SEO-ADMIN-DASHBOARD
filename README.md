# SEO Admin Dashboard

A multi-tenant SEO agency admin panel for managing clients, campaigns, keywords, backlinks, competitors, and reports with geo-grid rank tracking.

---

## Folder Structure

```
SEO-ADMIN-DASHBOARD/
├── backend/          # Express 5 API server (port 5000)
├── frontend/         # React + Vite + Tailwind UI (port 3000)
├── database/         # Drizzle ORM schema + PostgreSQL config
├── lib/
│   ├── api-zod/          # Zod validation schemas (shared)
│   ├── api-client-react/ # React Query hooks (shared)
│   └── api-spec/         # OpenAPI spec (orval codegen)
├── scripts/          # Workspace utility scripts
├── start-api.bat     # Windows: start backend
├── start-frontend.bat# Windows: start frontend
├── pnpm-workspace.yaml
└── package.json
```

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| pnpm | 9+ | `npm install -g pnpm` |
| PostgreSQL | 15+ | Must be running locally |

---

## 1. Clone & Install

```bash
git clone https://github.com/bellep-max/SEO-ADMIN-DASHBOARD.git
cd SEO-ADMIN-DASHBOARD
pnpm install --ignore-scripts
```

> **Windows note:** Use `--ignore-scripts` to skip the `sh`-based preinstall hook that only runs on Linux/Mac.

---

## 2. Database Setup

### Create the database

```sql
-- In psql or pgAdmin:
CREATE DATABASE seo_admin;
```

### Push the schema

```bash
# Set your DB connection string, then push the Drizzle schema
cd database
DATABASE_URL=postgresql://postgres:password@localhost:5432/seo_admin pnpm run push
cd ..
```

**Windows (PowerShell):**
```powershell
cd database
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/seo_admin"
pnpm run push
cd ..
```

> Replace `postgres:password` with your actual PostgreSQL username and password.

---

## 3. Build the Backend

The backend must be compiled before running:

```bash
cd backend
node build.mjs
cd ..
```

**Windows:**
```powershell
cd backend
node build.mjs
cd ..
```

---

## 4. Run the Backend (API Server — port 5000)

**Windows — use the provided batch file:**
```
start-api.bat
```

**Or manually (PowerShell):**
```powershell
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/seo_admin"
$env:PORT = "5000"
$env:NODE_ENV = "development"
$env:SESSION_SECRET = "your-secret-key-here"
node --enable-source-maps backend/dist/index.mjs
```

**Mac/Linux:**
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/seo_admin \
PORT=5000 \
NODE_ENV=development \
SESSION_SECRET=your-secret-key-here \
node --enable-source-maps backend/dist/index.mjs
```

Verify it's running: `http://localhost:5000/api/healthz`

---

## 5. Run the Frontend (port 3000)

**Windows — use the provided batch file:**
```
start-frontend.bat
```

**Or manually (PowerShell):**
```powershell
$env:PORT = "3000"
$env:BASE_PATH = "/"
$env:API_PORT = "5000"
$env:NODE_ENV = "development"
cd frontend
npx vite --host 0.0.0.0
```

**Mac/Linux:**
```bash
PORT=3000 BASE_PATH=/ API_PORT=5000 NODE_ENV=development \
cd frontend && npx vite --host 0.0.0.0
```

Open `http://localhost:3000` in your browser.

---

## Environment Variables

### Backend (`backend/`)

| Variable | Required | Example | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://postgres:password@localhost:5432/seo_admin` | PostgreSQL connection string |
| `PORT` | Yes | `5000` | API server port |
| `NODE_ENV` | Yes | `development` | Environment mode |
| `SESSION_SECRET` | Yes | `your-secret-key` | JWT signing secret |
| `SERPER_API_KEY` | No | `abc123` | For geo-grid rank tracking (falls back to mock data if not set) |

### Frontend (`frontend/`)

| Variable | Required | Example | Description |
|---|---|---|---|
| `PORT` | Yes | `3000` | Dev server port |
| `BASE_PATH` | Yes | `/` | URL base path |
| `API_PORT` | Yes | `5000` | Backend port (used for Vite proxy) |
| `NODE_ENV` | Yes | `development` | Environment mode |

---

## API Routes

| Route | Description |
|---|---|
| `GET /api/healthz` | Health check |
| `POST /api/auth/login` | Login |
| `GET /api/auth/me` | Current user |
| `GET/POST /api/clients` | List / create clients |
| `GET/PATCH/DELETE /api/clients/:id` | Get / update / delete client |
| `GET/POST /api/businesses` | List / create businesses |
| `GET/POST /api/campaigns` | List / create campaigns |
| `GET/POST /api/keywords` | List / add keywords |
| `GET/POST /api/backlinks` | List / add backlinks |
| `GET/POST /api/competitors` | List / add competitors |
| `GET/POST /api/plans` | List / create plans |
| `GET/POST /api/reports` | List / generate reports |
| `GET /api/dashboard/stats` | Dashboard stats |
| `GET /api/dashboard/activity` | Recent activity |
| `GET /api/dashboard/keyword-alerts` | Keyword rank drop alerts |
| `GET /api/geo-grid` | Geo-grid rank map (requires SERPER_API_KEY) |

---

## Default Login

After pushing the schema, create an admin user directly in the database:

```sql
-- Password below is bcrypt hash for "admin123" — change after first login
INSERT INTO users (email, password_hash)
VALUES ('admin@example.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');
```

---

## Rebuilding After Code Changes

Any time you change files in `backend/src/`, rebuild before restarting:

```bash
cd backend && node build.mjs
```

The frontend uses Vite HMR — changes to `frontend/src/` apply live without restart.

---

## Database Schema Changes

After editing any file in `database/src/schema/`:

```powershell
# Windows
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/seo_admin"
cd database
pnpm run push
```

---

## Tech Stack

- **Backend:** Node.js, Express 5, Drizzle ORM, PostgreSQL, pino logging, JWT auth
- **Frontend:** React 19, Vite 7, Tailwind CSS 4, TanStack Query, Wouter, shadcn/ui
- **Shared:** Zod schemas, OpenAPI spec, orval codegen, pnpm workspaces

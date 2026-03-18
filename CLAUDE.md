# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack application for tracking Pokémon card prices on Cardmarket over time. Three independent components:

- `cardmarket-backend/` — FastAPI + PostgreSQL REST API (SQLite locally)
- `cardmarket-frontend/` — React + TypeScript + Vite dashboard
- `cardmarket-scraper/` — Playwright-based web scraper

Deployed on Railway: backend + frontend as separate services, PostgreSQL plugin for production DB.

Each component has its own `CLAUDE.md` with more detailed guidance.

## Commands

### Backend (`cardmarket-backend/`)
```bash
pip install -r requirements.txt
alembic upgrade head                  # Apply schema migrations (runs automatically on Railway deploy)
uvicorn app.main:app --reload --port 8000

# Data pipeline (run from cardmarket-backend/ using .venv/Scripts/python)
python import_csv_runs.py        # Import CSVs from data/new/ into DB + compute realistic_price
python repair_prices.py          # Re-parse raw_cells + recompute realistic_price (langsam, alle offers)
python recompute_prices_only.py  # Nur realistic_price neu berechnen ohne Raw-Cells-Parsing (schnell)

# Sealed-Inhalte importieren (SQLite lokal oder Railway PostgreSQL):
python import_sealed_contents.py
DATABASE_URL=postgresql://... python import_sealed_contents.py

# Gegen Railway-PostgreSQL ausführen (z.B. nach Änderungen an Blacklist/Logik):
DATABASE_URL=postgresql://... python recompute_prices_only.py

# One-time SQLite → PostgreSQL data migration
SQLITE_PATH=./app.db DATABASE_URL=postgresql://... python migrate_sqlite_to_postgres.py
```

### Frontend (`cardmarket-frontend/`)
```bash
npm install
npm run dev      # Dev server at http://localhost:5173
npm run build    # TypeScript check + Vite production build
npm run lint     # ESLint
```

### Scraper (`cardmarket-scraper/`)
```bash
# Activate venv first (Windows): .venv\Scripts\activate
python scrape_cardmarket.py --setup              # First-time login, saves session (manuell)
python scrape_cardmarket.py --login --storage storage_state_a.json  # Auto-Login + Warmup (CM_USER/CM_PASS env)
python scrape_cardmarket.py                      # Full crawl (urls.txt)
python scrape_cardmarket.py --urls urls_test.txt --limit 4  # Test run
```

No test suite exists in any component.

## Arbeitsweise

**Nach jeder Änderung immer sofort committen und pushen** — auch bei Auto-Accept / automatisch angewendeten Edits. Railway deployed nur wenn Code auf GitHub (origin/main) landet. Nie Änderungen lokal lassen ohne Commit + Push.

## Architecture

### Data Flow
1. Scraper reads product URLs from `urls.txt`, crawls Cardmarket with Playwright, writes timestamped CSVs to `cardmarket-backend/data/new/`
2. `import_csv_runs.py` imports CSVs into DB (SQLite locally, PostgreSQL in production), computes `realistic_price` inline, moves files to `data/processed/` or `data/failed/`
3. FastAPI serves analytics over the populated database
4. React frontend fetches from FastAPI — locally via Vite's `/api` proxy, in production via `VITE_API_BASE_URL` env var

### Backend
- `app/routers/products.py` — CRUD for product catalog (SQLAlchemy ORM)
- `app/routers/insights.py` — analytics endpoints using raw SQL with CTEs and window functions (`ROW_NUMBER`, `LAG`)
- `app/routers/sealed.py` — `GET /sealed-contents/` und `GET /sealed-contents/{product_id}`
- `app/db_insights.py` — `fetch_all()` helper using SQLAlchemy `text()`, auto-converts `?` → `:p0, :p1` for dialect compatibility (SQLite + PostgreSQL)
- `app/database.py` — SQLAlchemy engine + `get_db()` dependency
- `app/schemas/` — Pydantic request/response models
- `migrations/` — Alembic migrations; startup runs `alembic upgrade head` before uvicorn

**Key tables** (managed by Alembic):
- `products` — Product catalog (`id`, `name`, `cardmarket_url`, `game`, `language`, `set_name`, `release_date`, `is_active`)
- `crawls` — Crawl run timestamps
- `product_stats` — Price stats per crawl per product (`realistic_price`, `from_price`, `price_trend`, `avg_30d/7d/1d`)
- `offers` — Individual seller offers per crawl
- `sealed_contents` — Sealed product contents: `product_id` (Sealed) → `component_type`, `qty`, `linked_product_id` (Single/Pack). Unique on `(product_id, component_type)`.

**Database:** SQLite (`app.db`) locally, PostgreSQL on Railway. Set via `DATABASE_URL` env var.
**CORS:** Dynamic via `ALLOWED_ORIGINS` env var (comma-separated). Defaults to localhost origins for local dev.

### sealed_contents Datenpflege
- Quelldatei: `data/sealed_contents.json` — Format: `{ "<product_id>": [{ "component_type": "booster_pack", "qty": 36, "linked_product_id": 122 }] }`
- Import-Script: `import_sealed_contents.py` — unterstützt SQLite (lokal) und PostgreSQL via `DATABASE_URL`
- Upsert-Logik: `ON CONFLICT (product_id, component_type) DO UPDATE SET qty, linked_product_id`
- Wenn `linked_product_id` nicht in `products` existiert → wird als NULL gespeichert (Warnung im Log)

### Value Ratio Endpoint (`GET /insights/value-ratios`)
Vergleicht Sealed-Preis vs. Summe der Einzelpreise aller verlinkten Komponenten.

- `value_ratio = singles_sum / sealed_price` — Ratio > 1: Sealed kaufen lohnt sich
- Nur Sealed-Produkte mit `realistic_price > 0` UND mind. einer Komponente mit bekanntem Preis erscheinen
- `component_url`: URL des Einzelpacks mit der höchsten Menge (Subquery nach `qty DESC LIMIT 1`)
- Response-Felder: `product_id`, `product_name`, `sealed_price`, `singles_sum`, `value_ratio`, `priced_components`, `sealed_url`, `component_url`

### PostgreSQL-Kompatibilität (bekannte Fallstricke)
Beim Schreiben von SQL-Queries für `fetch_all()` unbedingt beachten:

1. **`ROUND()` braucht `NUMERIC`**: `ROUND(float, n)` ist in PostgreSQL ungültig → `ROUND(CAST(expr AS NUMERIC), n)` verwenden
2. **`MAX(0.0, expr)` gibt es nicht**: In PostgreSQL ist `MAX` nur als Aggregatfunktion gültig, nicht als Skalarfunktion → `CASE WHEN expr < 0 THEN 0.0 ELSE expr END` verwenden
3. **SELECT-Aliases in `ORDER BY`**: Einfache Alias-Namen (`ORDER BY value_ratio DESC`) funktionieren. Aliases in komplexen Expressions (`CASE WHEN value_ratio IS NULL`) werden von PostgreSQL **nicht** aufgelöst → stattdessen `ORDER BY col DIRECTION NULLS LAST` verwenden
4. **Division durch Null**: PostgreSQL wirft bei `x / 0` einen Fehler (SQLite ignoriert es) → immer mit `WHERE realistic_price > 0` oder `NULLIF(col, 0)` absichern

### Auth (Supabase)
- Supabase-Projekt: `cardmarket-tracker` (ID: `ygpgvrkbzmxuqfkypdpi`)
- **Backend** (`app/auth.py`): JWT-Verifizierung via JWKS-Endpoint (`/auth/v1/.well-known/jwks.json`). Unterstützt ES256 (aktueller ECC P-256 Key) und HS256. Alle Routen geschützt via `Depends(get_current_user)` in `main.py`.
- **Frontend** (`src/lib/supabaseClient.ts`, `src/context/AuthContext.tsx`): Supabase JS-Client. Session wird automatisch per Refresh Token erneuert — Nutzer bleibt dauerhaft eingeloggt bis manueller Logout.
- **Login-Seite** (`src/pages/LoginPage.tsx`): E-Mail + Passwort. Nutzer werden in Supabase unter Authentication → Users angelegt.
- **Route-Schutz** (`src/components/ProtectedRoute.tsx`): Nicht eingeloggte Nutzer werden auf `/login` umgeleitet.
- **Wichtig:** Supabase hat im März 2025 von HS256 (Shared Secret) auf ECC P-256 (ES256) umgestellt. `SUPABASE_JWT_SECRET` wird nicht mehr verwendet — stattdessen `SUPABASE_URL` für JWKS-Lookup.

### Frontend
- `src/router/AppRouter.tsx` — 6 routes: Dashboard, Products, Top Movers, Monthly, Volatility, Value Ratio
- `src/api/client.ts` — Base fetch wrapper; uses `VITE_API_BASE_URL` env var (falls back to `/api` for local Vite proxy); hängt Supabase JWT automatisch als `Authorization: Bearer` Header an
- `src/api/insights.ts` — Typed API client functions for all insight endpoints
- `src/components/ui/ProductDetailModal.tsx` — Includes price history chart and offer distribution panel
- `src/pages/ProductsPage.tsx` — Sortable columns, `release_date` column
- `src/pages/ValueRatioPage.tsx` — Sealed vs. Singles Analyse; Zeilen öffnen ProductDetailModal; Link-Icons (↗) öffnen Cardmarket in neuem Tab ohne Modal-Trigger (`stopPropagation`)

### Deployment (Railway)
- **Backend service:** `cardmarket-backend/` — start: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Frontend service:** `cardmarket-frontend/` — build: `npm install && npm run build`, start: `npm start` (`serve -s dist`)
- **Backend env vars:** `DATABASE_URL` (auto from PostgreSQL plugin), `ALLOWED_ORIGINS=https://cardmarket-frontend.up.railway.app`, `SUPABASE_URL=https://ygpgvrkbzmxuqfkypdpi.supabase.co`
- **Frontend env vars:** `VITE_API_BASE_URL=https://cardmarket-backend-production-d772.up.railway.app`, `VITE_SUPABASE_URL=https://ygpgvrkbzmxuqfkypdpi.supabase.co`, `VITE_SUPABASE_ANON_KEY=<anon key>`
- **Lokal:** Frontend `.env.local` mit `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` (nicht committed)

### Scraper
Single-file scraper (`scrape_cardmarket.py`). Uses a visible Chromium browser with session cookies (`storage_state_a/b/c.json`) to handle Cloudflare and manual captcha solving. Random 8–14s delays between URLs; up to 3 retry attempts per URL.

**Cloud-Automatisierung (VPS: 178.104.83.145):**
- Hetzner CPX22, Ubuntu 24.04, User `crawl`
- Cron: alle 2 Tage 07:00 → `infra/run_crawl.sh`
- Account-Rotation: 3 Cardmarket-Accounts (A→B→C), Zähler in `~/.account_index`
- Vor jedem Crawl: automatischer Login + Cookie-Banner akzeptieren + 3 Warmup-URLs
- Credentials in `/home/crawl/.env`: `CM_ACCOUNT_A/B/C_USER/PASS`
- Nach Crawl: CSVs direkt in Railway PostgreSQL importiert
- Logs: `/home/crawl/logs/crawl_*.log`, `login_*.log`, `scraper_*.log`
- noVNC für Captcha-Lösung: `http://178.104.83.145:6080/vnc.html`
- `PLAYWRIGHT_BROWSERS_PATH=/home/crawl/.cache/ms-playwright` (in `.env`)

**Scraper Modi:**
- `--setup` — manueller Login, speichert Session (einmalig pro Account)
- `--login` — automatischer Login + Warmup (wird von `run_crawl.sh` verwendet)
- `--warmup` — nur Warmup ohne Login
- `--storage` — Pfad zur Session-Datei (default: `storage_state.json`)

**Known bug fixed:** `EURO_RE` was `r"(\d+[.,]\d+)\s*€"` — could not capture German prices ≥ 1,000 € (e.g. `1.800,00 €` was parsed as `800.0`). Fixed to `r"(\d+(?:[.,]\d+)*)\s*€"`. Run `repair_prices.py` to correct existing DB data.

### realistic_price Berechnung
`realistic_price` wird in `import_csv_runs.py` → `compute_realistic_prices_for_crawl()` berechnet:
1. **Keyword-Filter:** Angebote mit beschädigten/inhaltslosen Kommentaren werden entfernt (`KEYWORD_BLACKLIST`: "damage", "hole", "damaged", "fake", "proxy", "empty", "leer", u.v.m.)
2. **5 günstigste:** Von den verbleibenden Angeboten werden die 5 günstigsten nach `item_price` (ohne Versand) genommen
3. **Median:** Der Median dieser 5 Preise ergibt den `realistic_price`

**Wichtig:** `item_price` wird verwendet (nicht `total_price`) — Versandkosten variieren je nach Käuferstandort und werden bewusst ausgeschlossen.

Nach Änderungen an `KEYWORD_BLACKLIST` oder der Berechnungslogik: `recompute_prices_only.py` lokal und gegen Railway-DB laufen lassen.

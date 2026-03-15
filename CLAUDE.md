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
python scrape_cardmarket.py --setup              # First-time login, saves session
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
- `app/db_insights.py` — `fetch_all()` helper using SQLAlchemy `text()`, auto-converts `?` → `:p0, :p1` for dialect compatibility (SQLite + PostgreSQL)
- `app/database.py` — SQLAlchemy engine + `get_db()` dependency
- `app/schemas/` — Pydantic request/response models
- `migrations/` — Alembic migrations; startup runs `alembic upgrade head` before uvicorn

**Key tables** (managed by Alembic):
- `products` — Product catalog
- `crawls` — Crawl run timestamps
- `product_stats` — Price stats per crawl per product (`realistic_price`, `from_price`, `price_trend`, `avg_30d/7d/1d`)
- `offers` — Individual seller offers per crawl
- `sealed_contents` — Sealed product contents

**Database:** SQLite (`app.db`) locally, PostgreSQL on Railway. Set via `DATABASE_URL` env var.
**CORS:** Dynamic via `ALLOWED_ORIGINS` env var (comma-separated). Defaults to localhost origins for local dev.

### Frontend
- `src/router/AppRouter.tsx` — 6 routes: Dashboard, Products, Top Movers, Monthly, Volatility, Value Ratio
- `src/api/client.ts` — Base fetch wrapper; uses `VITE_API_BASE_URL` env var (falls back to `/api` for local Vite proxy)
- `src/api/insights.ts` — Typed API client functions for all insight endpoints
- `src/components/ui/ProductDetailModal.tsx` — Includes price history chart and offer distribution panel
- `src/pages/ProductsPage.tsx` — Sortable columns, `release_date` column

### Deployment (Railway)
- **Backend service:** `cardmarket-backend/` — start: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Frontend service:** `cardmarket-frontend/` — build: `npm install && npm run build`, start: `npm start` (`serve -s dist`)
- **Backend env vars:** `DATABASE_URL` (auto from PostgreSQL plugin), `ALLOWED_ORIGINS=https://cardmarket-frontend.up.railway.app`
- **Frontend env vars:** `VITE_API_BASE_URL=https://cardmarket-backend-production-d772.up.railway.app`

### Scraper
Single-file scraper (`scrape_cardmarket.py`). Uses a visible Chromium browser with session cookies (`storage_state.json`) to handle Cloudflare and manual captcha solving. Random 8–14s delays between URLs; up to 3 retry attempts per URL.

**Known bug fixed:** `EURO_RE` was `r"(\d+[.,]\d+)\s*€"` — could not capture German prices ≥ 1,000 € (e.g. `1.800,00 €` was parsed as `800.0`). Fixed to `r"(\d+(?:[.,]\d+)*)\s*€"`. Run `repair_prices.py` to correct existing DB data.

### realistic_price Berechnung
`realistic_price` wird in `import_csv_runs.py` → `compute_realistic_prices_for_crawl()` berechnet:
1. **Keyword-Filter:** Angebote mit beschädigten/inhaltslosen Kommentaren werden entfernt (`KEYWORD_BLACKLIST`: "damage", "hole", "damaged", "fake", "proxy", "empty", "leer", u.v.m.)
2. **5 günstigste:** Von den verbleibenden Angeboten werden die 5 günstigsten nach `item_price` (ohne Versand) genommen
3. **Median:** Der Median dieser 5 Preise ergibt den `realistic_price`

**Wichtig:** `item_price` wird verwendet (nicht `total_price`) — Versandkosten variieren je nach Käuferstandort und werden bewusst ausgeschlossen.

Nach Änderungen an `KEYWORD_BLACKLIST` oder der Berechnungslogik: `recompute_prices_only.py` lokal und gegen Railway-DB laufen lassen.

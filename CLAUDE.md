# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack application for tracking Pokémon card prices on Cardmarket over time. Three independent components:

- `cardmarket-backend/` — FastAPI + SQLite REST API
- `cardmarket-frontend/` — React + TypeScript + Vite dashboard
- `cardmarket-scraper/` — Playwright-based web scraper

Each component has its own `CLAUDE.md` with more detailed guidance.

## Commands

### Backend (`cardmarket-backend/`)
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Data pipeline (run from cardmarket-backend/ using .venv/Scripts/python)
python import_csv_runs.py   # Import CSVs from data/new/ into SQLite + compute realistic_price
python repair_prices.py     # One-time: re-parse raw_cells and recompute realistic_price for all crawls
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

## Architecture

### Data Flow
1. Scraper reads product URLs from `urls.txt`, crawls Cardmarket with Playwright, writes timestamped CSVs to `cardmarket-backend/data/new/`
2. `import_csv_runs.py` imports CSVs into SQLite (`app.db`), computes `realistic_price` inline, moves files to `data/processed/` or `data/failed/`
3. FastAPI serves analytics over the populated database
4. React frontend fetches from FastAPI via Vite's `/api` proxy

### Backend
- `app/routers/products.py` — CRUD for product catalog (SQLAlchemy ORM)
- `app/routers/insights.py` — 8 analytics endpoints using raw SQL with CTEs and SQLite window functions (`ROW_NUMBER`, `LAG`)
- `app/database.py` — SQLAlchemy engine + `get_db()` dependency
- `app/schemas/` — Pydantic request/response models

**Key tables** (schema inferred from raw SQL, not ORM):
- `products` — Product catalog
- `crawls` — Crawl run timestamps
- `product_stats` — Price stats per crawl per product (`realistic_price`, `from_price`, `price_trend`, `avg_30d/7d/1d`)
- `offers` — Individual seller offers per crawl

Database is SQLite at `cardmarket-backend/app.db`. CORS is configured for `localhost:8000` and `localhost:5173`.

### Frontend
- `src/router/AppRouter.tsx` — 6 routes: Dashboard, Products, Top Movers, Monthly, Volatility, Value Ratio
- `src/api/client.ts` — Base fetch wrapper; all `/api/*` requests are proxied by Vite to `http://127.0.0.1:8000`
- `src/api/insights.ts` — Typed API client functions for all insight endpoints
- `src/components/ui/ProductDetailModal.tsx` — Includes price history chart and offer distribution panel
- `src/pages/ProductsPage.tsx` — Sortable columns, `release_date` column

### Scraper
Single-file scraper (`scrape_cardmarket.py`). Uses a visible Chromium browser with session cookies (`storage_state.json`) to handle Cloudflare and manual captcha solving. Random 8–14s delays between URLs; up to 3 retry attempts per URL.

**Known bug fixed:** `EURO_RE` was `r"(\d+[.,]\d+)\s*€"` — could not capture German prices ≥ 1,000 € (e.g. `1.800,00 €` was parsed as `800.0`). Fixed to `r"(\d+(?:[.,]\d+)*)\s*€"`. Run `repair_prices.py` to correct existing DB data.

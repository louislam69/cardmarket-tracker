# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start the development server
uvicorn app.main:app --reload

# Run with specific port
uvicorn app.main:app --reload --port 8000

# Install dependencies
pip install -r requirements.txt

# Run data import scripts (from repo root)
python import_csv_runs.py
python compute_once.py
```

There is no test suite configured. There are no Docker or CI/CD files.

## Architecture

FastAPI backend for tracking Cardmarket product prices over time.

**Layer structure:**
- `app/routers/` — HTTP endpoints (two routers: `products`, `insights`)
- `app/schemas/` — Pydantic request/response models
- `app/models/` — SQLAlchemy ORM models
- `app/database.py` — Engine, session, and `get_db()` dependency

**Database:** SQLite (`app.db`) configured via `DATABASE_URL` in `.env`. The ORM is used for the `products` table only. All analytics queries in `app/routers/insights.py` use raw SQL with CTEs and SQLite window functions (`ROW_NUMBER`, `LAG`).

**Key tables** (not managed by ORM — schema is inferred from raw SQL):
- `products` — Product catalog (ORM-managed)
- `crawls` — Crawl run timestamps
- `product_stats` — Price stats per crawl per product
- `offers` — Individual offers from each crawl

**Data pipeline:** CSV files dropped in `data/new/` → import scripts (root-level `import_*.py`) → SQLite → API. Processed files move to `data/processed/`, failures to `data/failed/`.

**API surface:**
- `GET/POST/PATCH/DELETE /products` — CRUD
- `GET /insights/latest-prices` — Current prices with pagination/filtering
- `GET /insights/price-history/{product_id}` — Historical prices
- `GET /insights/top-movers` — Largest price changes
- `GET /insights/monthly-mom` — Month-over-month trends
- `GET /insights/summary` — Dashboard stats

CORS is configured for `localhost:8000` and `localhost:5173` (Vite frontend).

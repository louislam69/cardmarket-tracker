# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (use local venv)
pip install -r requirements.txt

# Start the development server
uvicorn app.main:app --reload --port 8000

# Data pipeline (run from cardmarket-backend/ using .venv/Scripts/python)
python import_csv_runs.py   # Import CSVs from data/new/, compute realistic_price inline
python repair_prices.py     # One-time repair: re-parse raw_cells, recompute realistic_price for all crawls
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
- `product_stats` — Price stats per crawl per product (`from_price`, `price_trend`, `avg_30d/7d/1d`, `realistic_price`, `offers_used`)
- `offers` — Individual seller offers per crawl (`item_price`, `shipping_price`, `total_price`, `raw_cells`)

**Data pipeline:** CSV files dropped in `data/new/` → `import_csv_runs.py` → SQLite → API. `realistic_price` and `offers_used` are computed inline during import (no separate script needed). Processed files move to `data/processed/`, failures to `data/failed/`.

**`repair_prices.py`:** One-time script to fix existing DB data when the scraper's price parser had a bug. Re-parses all `offers.raw_cells`, updates `item_price / shipping_price / total_price`, then re-runs `compute_realistic_prices_for_crawl` for every crawl.

**API surface:**
- `GET/POST/PATCH/DELETE /products` — CRUD
- `GET /insights/latest-prices` — Current prices with pagination/filtering
- `GET /insights/price-history/{product_id}` — Historical prices
- `GET /insights/top-movers` — Largest price changes
- `GET /insights/monthly-mom` — Month-over-month trends
- `GET /insights/summary` — Dashboard stats

CORS is configured for `localhost:8000` and `localhost:5173` (Vite frontend).

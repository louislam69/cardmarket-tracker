# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (use local venv)
pip install -r requirements.txt

# Apply schema migrations then start (SQLite locally)
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Data pipeline (run from cardmarket-backend/ using .venv/Scripts/python)
python import_csv_runs.py        # Import CSVs from data/new/, compute realistic_price inline
python repair_prices.py          # Re-parse raw_cells + recompute realistic_price (langsam über Netzwerk)
python recompute_prices_only.py  # Nur realistic_price neu berechnen, kein Raw-Cells-Parsing (schnell)

# Gegen Railway-PostgreSQL (nach Änderungen an Blacklist/Logik):
DATABASE_URL=postgresql://... python recompute_prices_only.py

# One-time SQLite → PostgreSQL data migration (run locally with public Railway DB URL)
SQLITE_PATH=./app.db DATABASE_URL=postgresql://... python migrate_sqlite_to_postgres.py
```

There is no test suite configured. Railway config is in `railway.json`.

## Architecture

FastAPI backend for tracking Cardmarket product prices over time.

**Layer structure:**
- `app/routers/` — HTTP endpoints (routers: `products`, `insights`, `sealed`)
- `app/schemas/` — Pydantic request/response models
- `app/models/` — SQLAlchemy ORM models
- `app/database.py` — Engine, session, and `get_db()` dependency
- `app/db_insights.py` — `fetch_all()` helper: SQLAlchemy `text()` + auto `?` → `:p0, :p1` conversion for dialect-agnostic raw SQL
- `migrations/` — Alembic migration scripts (all 5 tables in `versions/0001_initial_schema.py`)

**Database:** SQLite (`app.db`) locally, PostgreSQL on Railway. Configured via `DATABASE_URL` env var. Schema managed by Alembic — `alembic upgrade head` runs at startup on Railway. The ORM is used for the `products` table only. All analytics queries use raw SQL with CTEs and window functions (`ROW_NUMBER`, `LAG`) — these work on both SQLite and PostgreSQL.

**Key tables** (managed by Alembic):
- `products` — Product catalog (ORM-managed)
- `crawls` — Crawl run timestamps
- `product_stats` — Price stats per crawl per product (`from_price`, `price_trend`, `avg_30d/7d/1d`, `realistic_price`, `offers_used`)
- `offers` — Individual seller offers per crawl (`item_price`, `shipping_price`, `total_price`, `raw_cells`)
- `sealed_contents` — Contents of sealed products

**Data pipeline:** CSV files dropped in `data/new/` → `import_csv_runs.py` → DB → API. `realistic_price` and `offers_used` are computed inline during import. Processed files move to `data/processed/`, failures to `data/failed/`. `import_csv_runs.py` supports both SQLite (`?` placeholders) and PostgreSQL (`%s` placeholders) — dialect detected via `DATABASE_URL`.

**`repair_prices.py`:** Re-parst alle `offers.raw_cells`, aktualisiert `item_price / shipping_price / total_price`, dann `compute_realistic_prices_for_crawl` für jeden Crawl. Unterstützt SQLite + PostgreSQL. Langsam über Netzwerk (137k UPDATEs) — für reine Neuberechnung lieber `recompute_prices_only.py` nutzen.

**`recompute_prices_only.py`:** Schnelles Script — liest existierende `item_price`-Werte und berechnet `realistic_price` + `offers_used` für alle Crawls neu. Nutzen nach Änderungen an `KEYWORD_BLACKLIST` oder Berechnungslogik.

**`realistic_price` Logik** (in `compute_realistic_prices_for_crawl`):
1. Keyword-Filter: Angebote mit beschädigten/leeren/gefälschten Kommentaren entfernen (`KEYWORD_BLACKLIST`)
2. 5 günstigste `item_price`-Werte nehmen (ohne Versand — variiert je Käufer)
3. Median dieser 5 = `realistic_price`

**API surface:**
- `GET/POST/PATCH/DELETE /products` — CRUD
- `GET /insights/latest-prices` — Current prices with pagination/filtering
- `GET /insights/price-history/{product_id}` — Historical prices
- `GET /insights/top-movers` — Largest price changes
- `GET /insights/monthly-mom` — Month-over-month trends
- `GET /insights/summary` — Dashboard stats

**CORS:** Dynamic via `ALLOWED_ORIGINS` env var (comma-separated). Defaults to localhost:8000 and localhost:5173. In production set to `https://cardmarket-frontend.up.railway.app`.

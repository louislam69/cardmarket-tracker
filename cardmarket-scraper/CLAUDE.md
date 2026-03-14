# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment

- Python 3.14 with a local `.venv` virtual environment
- Activate: `.venv\Scripts\activate` (Windows)
- Dependencies are managed via the venv — key packages: `playwright`, `pandas`, `numpy`, `beautifulsoup4`, `lxml`, `httpx`

## Running the scraper

**First-time setup** (manual login, saves session cookies to `storage_state.json`):
```
python scrape_cardmarket.py --setup
```

**Full crawl** (reads all URLs from `urls.txt`, writes timestamped CSVs to `--out-dir`):
```
python scrape_cardmarket.py
```

**Test run** (uses `urls_test.txt` with 4 URLs, limits to N products):
```
python scrape_cardmarket.py --urls urls_test.txt --limit 4
```

**Key CLI arguments:**
- `--urls <file>` — input file of URLs (default: `urls.txt`)
- `--storage <file>` — path to session state JSON (default: `storage_state.json`)
- `--out-dir <dir>` — output folder for CSVs (default: `D:\cardmarket-backend\data\new`)
- `--limit <N>` — only crawl first N URLs
- `--run-tag <tag>` — optional suffix for output filenames

## Architecture

This is a single-file scraper (`scrape_cardmarket.py`) with no tests, no config files, and no secondary modules.

### Data flow

1. `read_urls()` reads `urls.txt` (skips blank lines and `#` comments)
2. Playwright launches a visible Chromium browser and loads `storage_state.json` for the session
3. For each URL, the scraper:
   - Navigates and waits for `domcontentloaded` + optional `networkidle`
   - Calls `ensure_human_check_and_persist()` — if Cloudflare/captcha is detected, pauses and prompts the user to solve it manually, then re-saves the session
   - `parse_product_info_block()` — reads the `<dl>` info block (available items, from price, price trend, 30/7/1-day averages); handles both German and English labels
   - `parse_offers()` — finds all seller rows by locating `a[href*="/Users/"]` links, walks up the DOM to find the containing row with `€`, deduplicates by `(seller, item_price, shipping, qty, snippet)`, and returns raw text per offer
   - `parse_offer_raw_cells()` — parses the pipe-joined raw text into structured fields (ratings, comment, item_price, shipping_price, total_price, qty)
4. Two CSVs are written incrementally (flushed after each URL):
   - **products CSV**: `crawl_timestamp, url, product_name, available_items, from_price, price_trend, avg_30d, avg_7d, avg_1d`
   - **offers CSV**: `crawl_timestamp, url, seller, ratings, comment, item_price, shipping_price, total_price, qty, price_text, raw_cells`
5. A `run_meta.json` is written to the output directory with run metadata

### Output structure

Each crawl creates timestamped files. Historical runs are stored under `runs/crawl_<timestamp>/`. The `offers.csv` and `products.csv` in the root are from the most recent run.

### Anti-bot measures

- Visible browser with `--disable-blink-features=AutomationControlled` and `slow_mo=120ms`
- Random delay of 8–14 seconds between URLs
- Up to 3 attempts per URL with exponential backoff (4–8s × attempt)
- Session cookies persisted to `storage_state.json` after each successful page (and immediately after solving any captcha)
- On timeout/error, a screenshot is saved as `timeout_<idx>_a<attempt>.png` or `error_<idx>_a<attempt>.png`

### Price parsing

Two separate parsers:
- `normalize_price()` — used for individual offer prices (item/shipping). Uses `EURO_RE = re.compile(r"(\d+(?:[.,]\d+)*)\s*€")`. The `(?:[.,]\d+)*` pattern handles German thousands separators (e.g. `1.800,00 €` → `1800.0`). **Bug history:** the original regex `r"(\d+[.,]\d+)\s*€"` only matched one separator group, causing prices ≥ 1,000 € to be parsed incorrectly (e.g. `1.800,00 €` → `800.0`). Fixed 2026-03-14; run `repair_prices.py` in the backend to correct historical data.
- `parse_price_eur()` — used for product-level stats (`from_price`, `price_trend`, averages). Strips `€`, removes `.` (thousands), replaces `,` with `.`. Correct for all price ranges.

The two last `€` values in an offer row are treated as item price and shipping respectively.

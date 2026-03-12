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

`normalize_price()` uses a regex for `€`-suffixed values. `parse_price_eur()` handles both German (comma decimal, dot thousands) and international formats. The two last `€` values in an offer row are treated as item price and shipping respectively.

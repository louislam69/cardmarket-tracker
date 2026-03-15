"""
repair_prices.py — Re-parse offer prices from stored raw_cells and recompute realistic_price.

Run once from cardmarket-backend/ after fixing EURO_RE in the scraper:
    python repair_prices.py

Why: The old EURO_RE regex r"(\\d+[.,]\\d+)\\s*€" could not capture German prices >= 1,000 €.
For example "1.800,00 €" was matched at "800,00 €", yielding 800.0 instead of 1800.0.
This script re-parses all stored raw_cells with the corrected regex and recomputes
realistic_price for every affected crawl.
"""

import re
import sqlite3
from typing import Optional, Dict

from import_csv_runs import get_connection, compute_realistic_prices_for_crawl, _sql

# ── Fixed regex: (?:[.,]\d+)* allows repeated thousands/decimal groups ──────
EURO_RE = re.compile(r"(\d+(?:[.,]\d+)*)\s*€")


def normalize_price(text: str) -> Optional[float]:
    m = EURO_RE.search((text or "").replace("\xa0", " "))
    if not m:
        return None
    v = m.group(1).replace(".", "").replace(",", ".")
    try:
        return float(v)
    except ValueError:
        return None


def parse_int_safe(s: str) -> Optional[int]:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return int(s)
    except ValueError:
        return None


def parse_offer_raw_cells(raw_cells: str, seller: str = "") -> Dict:
    parts = [p.strip() for p in (raw_cells or "").split("|")]
    parts = [p for p in parts if p != ""]

    seller = (seller or "").strip()

    ratings = None
    for p in parts:
        v = parse_int_safe(p)
        if v is not None:
            ratings = v
            break

    qty = None
    for p in reversed(parts):
        v = parse_int_safe(p)
        if v is not None:
            qty = v
            break

    euro_hits = []
    for idx, p in enumerate(parts):
        val = normalize_price(p)
        if val is not None:
            euro_hits.append((idx, p, val))

    item_price = shipping_price = total_price = None

    if len(euro_hits) >= 2:
        (_, _, i_val) = euro_hits[-2]
        (_, _, s_val) = euro_hits[-1]
        item_price = round(i_val, 2)
        shipping_price = round(s_val, 2)
        total_price = round(item_price + shipping_price, 2)
    elif len(euro_hits) == 1:
        (_, _, i_val) = euro_hits[-1]
        item_price = round(i_val, 2)
        total_price = item_price

    return {
        "item_price": item_price,
        "shipping_price": shipping_price,
        "total_price": total_price,
    }


def repair(conn: sqlite3.Connection):
    cur = conn.cursor()
    cur.execute(
        _sql("SELECT id, crawl_id, seller, raw_cells FROM offers WHERE raw_cells IS NOT NULL")
    )
    rows = cur.fetchall()
    print(f"Re-parsing {len(rows)} offers with raw_cells …")

    updates = []
    affected_crawls = set()

    for offer_id, crawl_id, seller, raw_cells in rows:
        parsed = parse_offer_raw_cells(raw_cells, seller or "")
        updates.append((
            parsed["item_price"],
            parsed["shipping_price"],
            parsed["total_price"],
            offer_id,
        ))
        affected_crawls.add(crawl_id)

    cur.executemany(
        _sql("UPDATE offers SET item_price=?, shipping_price=?, total_price=? WHERE id=?"),
        updates,
    )
    conn.commit()
    print(f"Updated {len(updates)} offer rows across {len(affected_crawls)} crawls.")

    for crawl_id in sorted(affected_crawls):
        print(f"  Recomputing realistic_price for crawl_id={crawl_id} …")
        compute_realistic_prices_for_crawl(conn, crawl_id)

    print("Done.")


if __name__ == "__main__":
    conn = get_connection()
    try:
        repair(conn)
    finally:
        conn.close()

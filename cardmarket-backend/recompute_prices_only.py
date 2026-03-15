"""
recompute_prices_only.py — Recomputes realistic_price for all crawls
without re-parsing raw_cells. Much faster than repair_prices.py over network.
"""
from import_csv_runs import get_connection, compute_realistic_prices_for_crawl, _sql

conn = get_connection()
try:
    cur = conn.cursor()
    cur.execute(_sql("SELECT id FROM crawls ORDER BY id"))
    crawl_ids = [row[0] for row in cur.fetchall()]
    print(f"Recomputing realistic_price for {len(crawl_ids)} crawls ...")
    for crawl_id in crawl_ids:
        print(f"  crawl_id={crawl_id} ...", end=" ", flush=True)
        compute_realistic_prices_for_crawl(conn, crawl_id)
    print("Done.")
finally:
    conn.close()

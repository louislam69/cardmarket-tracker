import sqlite3

DB_PATH = "app.db"

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # All crawls newest -> oldest
    cur.execute("""
        SELECT id, crawl_timestamp
        FROM crawls
        ORDER BY crawl_timestamp DESC
    """)
    crawls = cur.fetchall()

    if not crawls:
        print("No crawls found.")
        return

    print(f"Found {len(crawls)} crawls\n")

    # Header
    print(
        "crawl_id | timestamp           | stats_rows | offers_rows | realistic_filled | coverage% | status"
    )
    print("-" * 95)

    for crawl_id, ts in crawls:
        cur.execute("SELECT COUNT(*) FROM product_stats WHERE crawl_id = ?", (crawl_id,))
        stats_rows = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM offers WHERE crawl_id = ?", (crawl_id,))
        offers_rows = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*)
            FROM product_stats
            WHERE crawl_id = ? AND realistic_price IS NOT NULL
        """, (crawl_id,))
        realistic_filled = cur.fetchone()[0]

        coverage = 0.0
        if stats_rows > 0:
            coverage = (realistic_filled / stats_rows) * 100.0

        # Simple status rules
        status = "OK"
        if stats_rows == 0:
            status = "NO_STATS"
        elif offers_rows == 0:
            status = "NO_OFFERS"
        elif realistic_filled == 0:
            status = "NO_REALISTIC"
        elif coverage < 50:
            status = "LOW_COVERAGE"

        print(
            f"{crawl_id:7d} | {ts:19s} | {stats_rows:9d} | {offers_rows:10d} | {realistic_filled:15d} | "
            f"{coverage:8.1f}% | {status}"
        )

    # Quick summary
    cur.execute("SELECT COUNT(*) FROM crawls")
    total_crawls = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*)
        FROM product_stats
        WHERE realistic_price IS NOT NULL
    """)
    total_realistic_rows = cur.fetchone()[0]

    print("\nSummary")
    print("-" * 20)
    print("total crawls:", total_crawls)
    print("total product_stats with realistic_price:", total_realistic_rows)

    conn.close()


if __name__ == "__main__":
    main()

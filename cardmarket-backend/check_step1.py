import sqlite3

DB_PATH = "app.db"

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# latest crawl id + timestamp
cur.execute("SELECT id, crawl_timestamp FROM crawls ORDER BY crawl_timestamp DESC LIMIT 1;")
row = cur.fetchone()
print("Latest crawl:", row)

if row:
    crawl_id = row[0]

    # how many stats rows for latest crawl
    cur.execute("SELECT COUNT(*) FROM product_stats WHERE crawl_id = ?;", (crawl_id,))
    print("product_stats rows (latest crawl):", cur.fetchone()[0])

    # how many realistic_price filled
    cur.execute("""
        SELECT COUNT(*)
        FROM product_stats
        WHERE crawl_id = ? AND realistic_price IS NOT NULL
    """, (crawl_id,))
    print("realistic_price filled rows:", cur.fetchone()[0])

    # show a few examples
    cur.execute("""
        SELECT product_id, realistic_price, offers_used
        FROM product_stats
        WHERE crawl_id = ? AND realistic_price IS NOT NULL
        LIMIT 10
    """, (crawl_id,))
    print("Samples:", cur.fetchall())

conn.close()
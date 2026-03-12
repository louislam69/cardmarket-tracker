import sqlite3

conn = sqlite3.connect("app.db")
cur = conn.cursor()

cur.execute("SELECT id FROM crawls ORDER BY crawl_timestamp DESC LIMIT 1;")
crawl_id = cur.fetchone()[0]
print("crawl_id:", crawl_id)

cur.execute("""
SELECT COUNT(*)
FROM offers o
JOIN product_stats ps
  ON ps.crawl_id = o.crawl_id
 AND ps.product_id = o.product_id
WHERE o.crawl_id = ?;
""", (crawl_id,))
print("join matches offers<->product_stats:", cur.fetchone()[0])

# show some product_ids from each side
cur.execute("SELECT DISTINCT product_id FROM offers WHERE crawl_id=? ORDER BY product_id LIMIT 15;", (crawl_id,))
print("offers product_ids sample:", [r[0] for r in cur.fetchall()])

cur.execute("SELECT DISTINCT product_id FROM product_stats WHERE crawl_id=? ORDER BY product_id LIMIT 15;", (crawl_id,))
print("product_stats product_ids sample:", [r[0] for r in cur.fetchall()])

conn.close()

import sqlite3

conn = sqlite3.connect("app.db")
cur = conn.cursor()

cur.execute("""
WITH latest AS (
  SELECT
    ps.product_id,
    ps.realistic_price,
    c.crawl_timestamp,
    ROW_NUMBER() OVER (
      PARTITION BY ps.product_id
      ORDER BY c.crawl_timestamp DESC
    ) AS rn
  FROM product_stats ps
  JOIN crawls c ON c.id = ps.crawl_id
  WHERE ps.realistic_price IS NOT NULL
)
SELECT COUNT(*) FROM latest WHERE rn = 1;
""")

print("latest-per-product rows:", cur.fetchone()[0])
conn.close()

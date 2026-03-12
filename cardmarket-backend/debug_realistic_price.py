import sqlite3

DB_PATH = "app.db"

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("SELECT id, crawl_timestamp FROM crawls ORDER BY crawl_timestamp DESC LIMIT 1;")
crawl = cur.fetchone()
print("Latest crawl:", crawl)
crawl_id = crawl[0]

# 1) Offers count for this crawl
cur.execute("SELECT COUNT(*) FROM offers WHERE crawl_id = ?;", (crawl_id,))
offers_count = cur.fetchone()[0]
print("offers rows (latest crawl):", offers_count)

# 2) Non-null total_price count
cur.execute("""
    SELECT COUNT(*)
    FROM offers
    WHERE crawl_id = ? AND total_price IS NOT NULL
""", (crawl_id,))
non_null_prices = cur.fetchone()[0]
print("offers with total_price NOT NULL:", non_null_prices)

# 3) Check a few offer rows
cur.execute("""
    SELECT product_id, total_price
    FROM offers
    WHERE crawl_id = ?
    LIMIT 10
""", (crawl_id,))
print("offer samples:", cur.fetchall())

# 4) How many products have >= 3 offers (needed after skipping 2)
cur.execute("""
    SELECT COUNT(*)
    FROM (
      SELECT product_id, COUNT(*) AS n
      FROM offers
      WHERE crawl_id = ? AND total_price IS NOT NULL
      GROUP BY product_id
      HAVING n >= 3
    )
""", (crawl_id,))
products_with_3 = cur.fetchone()[0]
print("products with >= 3 offers:", products_with_3)

# 5) How many products have >= 7 offers (full logic 2 skip + 5 average)
cur.execute("""
    SELECT COUNT(*)
    FROM (
      SELECT product_id, COUNT(*) AS n
      FROM offers
      WHERE crawl_id = ? AND total_price IS NOT NULL
      GROUP BY product_id
      HAVING n >= 7
    )
""", (crawl_id,))
products_with_7 = cur.fetchone()[0]
print("products with >= 7 offers:", products_with_7)

conn.close()

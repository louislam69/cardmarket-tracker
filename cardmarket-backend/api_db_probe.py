import os, sqlite3

print("CWD:", os.getcwd())
print("app.db abs path:", os.path.abspath("app.db"))

conn = sqlite3.connect("app.db")
cur = conn.cursor()

cur.execute("SELECT id, crawl_timestamp FROM crawls ORDER BY crawl_timestamp DESC LIMIT 1;")
print("Latest crawl:", cur.fetchone())

cur.execute("""
SELECT COUNT(*)
FROM product_stats
WHERE crawl_id = (SELECT id FROM crawls ORDER BY crawl_timestamp DESC LIMIT 1)
  AND realistic_price IS NOT NULL;
""")
print("realistic_price rows in latest crawl:", cur.fetchone()[0])

conn.close()

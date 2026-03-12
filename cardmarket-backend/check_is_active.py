import sqlite3

conn = sqlite3.connect("app.db")
cur = conn.cursor()

cur.execute("""
SELECT
  SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
  SUM(CASE WHEN is_active IS NULL THEN 1 ELSE 0 END) AS nulls,
  SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive,
  COUNT(*) AS total
FROM products;
""")
print("products is_active stats:", cur.fetchone())

conn.close()

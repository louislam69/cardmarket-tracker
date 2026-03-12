import sqlite3

DB_PATH = "app.db"

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Show existing columns
    cur.execute("PRAGMA table_info(product_stats);")
    cols = [row[1] for row in cur.fetchall()]
    print("Before:", cols)

    # Add missing columns safely
    if "realistic_price" not in cols:
        print("Adding column realistic_price ...")
        cur.execute("ALTER TABLE product_stats ADD COLUMN realistic_price REAL;")
    else:
        print("Column realistic_price already exists.")

    if "offers_used" not in cols:
        print("Adding column offers_used ...")
        cur.execute("ALTER TABLE product_stats ADD COLUMN offers_used INTEGER;")
    else:
        print("Column offers_used already exists.")

    conn.commit()

    # Verify
    cur.execute("PRAGMA table_info(product_stats);")
    cols_after = [row[1] for row in cur.fetchall()]
    print("After:", cols_after)

    conn.close()

if __name__ == "__main__":
    main()
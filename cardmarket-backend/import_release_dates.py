"""
import_release_dates.py
-----------------------
1. Adds the `release_date` column to `products` if it does not exist yet.
2. Reads data/release_dates.json and writes dates into the DB.

Run from cardmarket-backend/:
    python import_release_dates.py
"""

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "app.db"
JSON_PATH = Path(__file__).parent / "data" / "release_dates.json"


def add_column_if_missing(conn: sqlite3.Connection) -> None:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(products)")}
    if "release_date" not in cols:
        conn.execute("ALTER TABLE products ADD COLUMN release_date TEXT")
        conn.commit()
        print("Column 'release_date' added to products table.")
    else:
        print("Column 'release_date' already exists — skipping ALTER TABLE.")


def import_dates(conn: sqlite3.Connection, data: dict) -> None:
    updated = skipped = missing = 0
    for id_str, date_val in data.items():
        if id_str.startswith("_"):  # skip comment keys
            continue
        if date_val is None:
            skipped += 1
            continue
        product_id = int(id_str)
        row = conn.execute("SELECT id FROM products WHERE id = ?", (product_id,)).fetchone()
        if row is None:
            print(f"  WARNING: product id={product_id} not found in DB — skipping.")
            missing += 1
            continue
        conn.execute(
            "UPDATE products SET release_date = ? WHERE id = ?",
            (date_val, product_id),
        )
        updated += 1

    conn.commit()
    print(f"Done: {updated} updated, {skipped} skipped (null), {missing} not found.")


def main() -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Database not found at {DB_PATH}")
    if not JSON_PATH.exists():
        raise FileNotFoundError(f"JSON file not found at {JSON_PATH}")

    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)

    conn = sqlite3.connect(DB_PATH)
    try:
        add_column_if_missing(conn)
        import_dates(conn, data)
    finally:
        conn.close()


if __name__ == "__main__":
    main()

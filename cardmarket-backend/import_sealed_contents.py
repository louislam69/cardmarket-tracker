"""
import_sealed_contents.py
-------------------------
1. Erstellt die `sealed_contents`-Tabelle, falls sie noch nicht existiert.
2. Liest data/sealed_contents.json und schreibt die Inhalte in die DB.

Format der JSON-Datei:
  {
    "_comment": "...",
    "<product_id>": [
      { "component_type": "booster_pack", "qty": 36, "linked_product_id": null },
      ...
    ]
  }

Ausführen aus cardmarket-backend/:
    python import_sealed_contents.py
"""

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "app.db"
JSON_PATH = Path(__file__).parent / "data" / "sealed_contents.json"

ALLOWED_TYPES = {
    "booster_pack",
    "etb_box",
    "booster_box",
    "promo_card",
    "promo_code",
    "coin",
    "damage_counter",
    "dice",
    "card_sleeves",
    "deck_box",
    "playmat",
    "sticker_sheet",
    "poster",
    "binder",
    "rulebook",
    "pin_badge",
    "figure",
}


def create_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sealed_contents (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id          INTEGER NOT NULL REFERENCES products(id),
            component_type      TEXT    NOT NULL,
            qty                 INTEGER NOT NULL,
            linked_product_id   INTEGER REFERENCES products(id),
            UNIQUE(product_id, component_type)
        )
        """
    )
    conn.commit()
    print("Table 'sealed_contents' ready.")


def import_contents(conn: sqlite3.Connection, data: dict) -> None:
    inserted = skipped = 0

    for id_str, components in data.items():
        if id_str.startswith("_"):
            continue

        product_id = int(id_str)

        # Produkt muss in DB existieren
        if not conn.execute("SELECT 1 FROM products WHERE id = ?", (product_id,)).fetchone():
            print(f"  WARNING: product_id={product_id} nicht in DB — übersprungen.")
            skipped += len(components) if isinstance(components, list) else 1
            continue

        if not isinstance(components, list):
            print(f"  WARNING: product_id={product_id} — Wert ist keine Liste — übersprungen.")
            skipped += 1
            continue

        for comp in components:
            component_type = comp.get("component_type")
            qty = comp.get("qty")
            linked_product_id = comp.get("linked_product_id")

            if component_type not in ALLOWED_TYPES:
                print(
                    f"  WARNING: product_id={product_id} — ungültiger component_type '{component_type}' — übersprungen."
                )
                skipped += 1
                continue

            if not isinstance(qty, int) or qty <= 0:
                print(
                    f"  WARNING: product_id={product_id}, type={component_type} — ungültige qty={qty!r} — übersprungen."
                )
                skipped += 1
                continue

            if linked_product_id is not None:
                if not conn.execute(
                    "SELECT 1 FROM products WHERE id = ?", (linked_product_id,)
                ).fetchone():
                    print(
                        f"  WARNING: linked_product_id={linked_product_id} nicht in DB — wird als NULL gespeichert."
                    )
                    linked_product_id = None

            conn.execute(
                """
                INSERT OR REPLACE INTO sealed_contents (product_id, component_type, qty, linked_product_id)
                VALUES (?, ?, ?, ?)
                """,
                (product_id, component_type, qty, linked_product_id),
            )
            inserted += 1

    conn.commit()
    print(f"Done: {inserted} Zeilen eingefügt/ersetzt, {skipped} übersprungen.")


def main() -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Datenbank nicht gefunden: {DB_PATH}")
    if not JSON_PATH.exists():
        raise FileNotFoundError(f"JSON-Datei nicht gefunden: {JSON_PATH}")

    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)

    conn = sqlite3.connect(DB_PATH)
    try:
        create_table(conn)
        import_contents(conn, data)
    finally:
        conn.close()


if __name__ == "__main__":
    main()

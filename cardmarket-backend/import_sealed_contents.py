"""
import_sealed_contents.py
-------------------------
Liest data/sealed_contents.json und schreibt die Inhalte in die DB.
Unterstützt SQLite (lokal) und PostgreSQL (Railway) via DATABASE_URL.

Format der JSON-Datei:
  {
    "_comment": "...",
    "<product_id>": [
      { "component_type": "booster_pack", "qty": 36, "linked_product_id": null },
      ...
    ]
  }

Ausführen aus cardmarket-backend/:
    python import_sealed_contents.py                          # SQLite lokal
    DATABASE_URL=postgresql://... python import_sealed_contents.py  # Railway PostgreSQL
"""

import json
import os
from pathlib import Path
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
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


def import_contents(data: dict) -> None:
    engine = create_engine(DATABASE_URL)
    inserted = skipped = 0

    with engine.begin() as conn:
        for id_str, components in data.items():
            if id_str.startswith("_"):
                continue

            product_id = int(id_str)

            if not conn.execute(text("SELECT 1 FROM products WHERE id = :id"), {"id": product_id}).fetchone():
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
                        text("SELECT 1 FROM products WHERE id = :id"), {"id": linked_product_id}
                    ).fetchone():
                        print(
                            f"  WARNING: linked_product_id={linked_product_id} nicht in DB — wird als NULL gespeichert."
                        )
                        linked_product_id = None

                conn.execute(
                    text("""
                        INSERT INTO sealed_contents (product_id, component_type, qty, linked_product_id)
                        VALUES (:product_id, :component_type, :qty, :linked_product_id)
                        ON CONFLICT (product_id, component_type) DO UPDATE SET
                            qty = EXCLUDED.qty,
                            linked_product_id = EXCLUDED.linked_product_id
                    """),
                    {
                        "product_id": product_id,
                        "component_type": component_type,
                        "qty": qty,
                        "linked_product_id": linked_product_id,
                    },
                )
                inserted += 1

    print(f"Done: {inserted} Zeilen eingefügt/ersetzt, {skipped} übersprungen.")


def main() -> None:
    if not JSON_PATH.exists():
        raise FileNotFoundError(f"JSON-Datei nicht gefunden: {JSON_PATH}")

    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)

    if "postgresql" in DATABASE_URL:
        print("Verbinde mit PostgreSQL...")
    else:
        print("Verbinde mit SQLite (app.db)...")

    import_contents(data)


if __name__ == "__main__":
    main()

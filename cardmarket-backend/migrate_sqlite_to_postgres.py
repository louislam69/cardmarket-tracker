"""
migrate_sqlite_to_postgres.py
=================================
Einmalige Datenmigration von SQLite → PostgreSQL.

Verwendung:
    SQLITE_PATH=./app.db DATABASE_URL=postgresql://user:pass@host:port/db python migrate_sqlite_to_postgres.py

Ablauf:
1. Liest alle Daten aus SQLite (Quelle)
2. Schreibt sie in PostgreSQL (Ziel, via psycopg2)
3. Setzt alle Sequences zurück (damit Auto-Increment korrekt weiterläuft)

Idempotent: ON CONFLICT DO NOTHING — kann mehrfach ausgeführt werden.
"""

import os
import sys
import sqlite3
from pathlib import Path

import psycopg2
import psycopg2.extras


# =========================
# CONFIG
# =========================

SQLITE_PATH = os.environ.get("SQLITE_PATH", "./app.db")
PG_URL = os.environ.get("DATABASE_URL", "")

if not PG_URL or not PG_URL.startswith(("postgresql", "postgres")):
    print("ERROR: DATABASE_URL muss auf eine PostgreSQL-DB zeigen.")
    print("  Beispiel: DATABASE_URL=postgresql://user:pass@host:5432/db python migrate_sqlite_to_postgres.py")
    sys.exit(1)

# Tabellen in FK-Reihenfolge (parents zuerst)
TABLES = ["products", "crawls", "product_stats", "offers", "sealed_contents"]


# =========================
# HELPERS
# =========================

def get_sqlite_conn(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def get_pg_conn(url: str):
    return psycopg2.connect(url)


def get_columns(sqlite_conn: sqlite3.Connection, table: str) -> list[str]:
    cur = sqlite_conn.cursor()
    cur.execute(f"SELECT * FROM {table} LIMIT 0")
    return [desc[0] for desc in cur.description]


def migrate_table(sqlite_conn: sqlite3.Connection, pg_conn, table: str) -> int:
    """Migriert eine Tabelle vollständig. Gibt Anzahl migrierter Zeilen zurück."""
    cur_sqlite = sqlite_conn.cursor()
    cur_sqlite.execute(f"SELECT COUNT(*) FROM {table}")
    total = cur_sqlite.fetchone()[0]

    if total == 0:
        print(f"  [{table}] leer — übersprungen")
        return 0

    columns = get_columns(sqlite_conn, table)
    cur_sqlite.execute(f"SELECT * FROM {table}")
    rows = cur_sqlite.fetchall()

    # Für products: is_active (0/1) → bool
    bool_cols = {"is_active"} if table == "products" else set()

    converted_rows = []
    for row in rows:
        row_dict = dict(row)
        for col in bool_cols:
            if col in row_dict and row_dict[col] is not None:
                row_dict[col] = bool(row_dict[col])
        converted_rows.append(tuple(row_dict[c] for c in columns))

    col_list = ", ".join(columns)
    placeholders = ", ".join(["%s"] * len(columns))

    # ON CONFLICT DO NOTHING → idempotent
    sql = f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"

    cur_pg = pg_conn.cursor()
    psycopg2.extras.execute_batch(cur_pg, sql, converted_rows, page_size=500)
    pg_conn.commit()

    print(f"  [{table}] {len(converted_rows)} Zeilen migriert")
    return len(converted_rows)


def reset_sequences(pg_conn):
    """
    Setzt alle SERIAL-Sequences auf MAX(id) + 1 zurück,
    damit neue Inserts nicht mit migrierten IDs kollidieren.
    """
    cur = pg_conn.cursor()
    tables_with_serial = ["products", "crawls", "product_stats", "offers", "sealed_contents"]

    for table in tables_with_serial:
        cur.execute(f"SELECT MAX(id) FROM {table}")
        max_id = cur.fetchone()[0]
        if max_id is None:
            continue
        # Sequence-Name: PostgreSQL-Konvention ist <table>_id_seq
        seq_name = f"{table}_id_seq"
        cur.execute(f"SELECT setval('{seq_name}', %s)", (max_id,))
        print(f"  Sequence {seq_name} -> {max_id}")

    pg_conn.commit()


# =========================
# MAIN
# =========================

def main():
    sqlite_path = Path(SQLITE_PATH).resolve()
    if not sqlite_path.exists():
        print(f"ERROR: SQLite-Datei nicht gefunden: {sqlite_path}")
        sys.exit(1)

    print(f"Quelle:  SQLite  -> {sqlite_path}")
    print(f"Ziel:    PostgreSQL -> {PG_URL.split('@')[-1]}")
    print()

    sqlite_conn = get_sqlite_conn(str(sqlite_path))
    pg_conn = get_pg_conn(PG_URL)

    total_rows = 0
    for table in TABLES:
        print(f"Migriere {table}...")
        n = migrate_table(sqlite_conn, pg_conn, table)
        total_rows += n

    print()
    print("Setze Sequences zurück...")
    reset_sequences(pg_conn)

    sqlite_conn.close()
    pg_conn.close()

    print()
    print(f"Migration abgeschlossen. {total_rows} Zeilen total migriert.")
    print()
    print("Nächste Schritte:")
    print("  1. Backend auf Railway deployen")
    print("  2. GET /health prüfen")
    print("  3. Einige Endpoints testen (z.B. /insights/summary)")


if __name__ == "__main__":
    main()

import os
import re
import shutil
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

import pandas as pd

# =========================
# CONFIG / HELPERS
# =========================

RUN_RE = re.compile(r"^(products|offers)_(\d{4}-\d{2}-\d{2})_(\d{6})\.csv$")

KEYWORD_BLACKLIST = [
    # Leere / inhaltlose Artikel
    "empty", "leer", "display only", "box only", "ohne inhalt", "keine karten",
    "no cards", "not included", "without cards", "foil only", "wrapper",
    "hülle", "sleeve only", "code only", "code card", "insert only",
    # Beschädigt / manipuliert
    "damaged", "heavily damaged", "water damage", "bent", "creased",
    "altered", "fake", "proxy", "resealed", "opened", "repack",
    # Unvollständig / Sonstiges
    "sample", "misprint", "token only", "not mint",
]

# Dialect detection — set once at module load
_DB_URL = os.getenv("DATABASE_URL", "")
_IS_PG = _DB_URL.startswith(("postgresql", "postgres://", "postgres+"))


def _sql(query: str) -> str:
    """Konvertiert ? → %s für PostgreSQL."""
    return query.replace("?", "%s") if _IS_PG else query


def parse_eur_text(s: str | float | int | None) -> float | None:
    """Parst '1.234,56 €' / '123,45 €' robust zu float."""
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s)
    s = str(s).replace("€", "").replace("\xa0", " ").replace(" ", "").strip()
    if not s:
        return None
    s = s.replace(".", "")   # Tausenderpunkt entfernen
    s = s.replace(",", ".")  # Dezimal-Komma
    try:
        return float(s)
    except ValueError:
        return None


def read_csv_fallback(path: Path) -> pd.DataFrame:
    """Robust CSV reader for Windows/Excel exports.

    - Encoding fallback: utf-8-sig -> cp1252 -> latin1
    - Delimiter auto-detection: sep=None + engine='python' (detects ',' and ';')
    - Never crashes on encoding: final fallback uses latin1 with errors='replace'
    """
    for enc in ("utf-8-sig", "cp1252", "latin1"):
        try:
            with open(path, "r", encoding=enc, errors="strict", newline="") as f:
                return pd.read_csv(f, sep=None, engine="python")
        except UnicodeDecodeError:
            continue
        except Exception:
            continue

    with open(path, "r", encoding="latin1", errors="replace", newline="") as f:
        return pd.read_csv(f, sep=None, engine="python")


def find_run_pairs(folder: Path) -> List[Tuple[str, Path, Path]]:
    """Findet products/offers Paare anhand der Run-ID im Dateinamen."""
    files = [p for p in folder.iterdir() if p.is_file() and p.name.endswith(".csv")]
    runs: Dict[str, Dict[str, Path]] = {}
    for f in files:
        m = RUN_RE.match(f.name)
        if not m:
            continue
        kind, d, t = m.group(1), m.group(2), m.group(3)
        run_key = f"{d}_{t}"
        runs.setdefault(run_key, {})[kind] = f

    pairs: List[Tuple[str, Path, Path]] = []
    for run_key, dct in runs.items():
        if "products" in dct and "offers" in dct:
            pairs.append((run_key, dct["products"], dct["offers"]))
    return sorted(pairs, key=lambda x: x[0])


# =========================
# DB CONNECT
# =========================

def _sqlite_path_from_database_url(database_url: str, base_dir: Path) -> Path:
    """
    Supports:
      - sqlite:///./app.db
      - sqlite:///app.db
      - sqlite:////absolute/path/app.db
    """
    clean = database_url.split("?", 1)[0]

    if clean.startswith("sqlite:///"):
        p = clean[len("sqlite:///"):]
        # Relative path -> relative to this script folder
        if not (p.startswith("/") or re.match(r"^[A-Za-z]:[\\/]", p)):
            return (base_dir / p).resolve()
        return Path(p).resolve()

    if clean.startswith("sqlite://"):
        p = clean[len("sqlite://"):]
        return (base_dir / p).resolve()

    raise ValueError(f"Unsupported DATABASE_URL for sqlite import: {database_url}")


def get_connection():
    """
    Verbindet zur DB (SQLite oder PostgreSQL) abhängig von DATABASE_URL.
    """
    db_url = os.getenv("DATABASE_URL") or os.getenv("DATABASE_URI") or ""

    if _IS_PG:
        import psycopg2
        conn = psycopg2.connect(db_url)
        conn.autocommit = False
        return conn

    # SQLite-Pfad
    base_dir = Path(__file__).resolve().parent
    if db_url and db_url.startswith("sqlite"):
        db_path = _sqlite_path_from_database_url(db_url, base_dir)
    else:
        db_path = (base_dir / "app.db").resolve()

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


# =========================
# DB SCHEMA
# =========================

def ensure_tables(conn):
    """
    Für SQLite: legt Tabellen an falls nicht vorhanden.
    Für PostgreSQL: no-op (Alembic hat die Tabellen bereits erstellt).
    """
    if _IS_PG:
        return

    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS crawls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crawl_timestamp TEXT UNIQUE NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE NOT NULL,
        product_name TEXT
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS product_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crawl_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        available_items INTEGER,
        from_price REAL,
        price_trend REAL,
        avg_30d REAL,
        avg_7d REAL,
        avg_1d REAL,
        UNIQUE (crawl_id, product_id),
        FOREIGN KEY (crawl_id) REFERENCES crawls(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS offers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crawl_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        seller TEXT,
        ratings INTEGER,
        comment TEXT,
        item_price REAL,
        shipping_price REAL,
        total_price REAL,
        qty INTEGER,
        price_text TEXT,
        raw_cells TEXT,
        FOREIGN KEY (crawl_id) REFERENCES crawls(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
    """)

    conn.commit()


# =========================
# IMPORT LOGIC
# =========================

def upsert_crawl(conn, crawl_ts: datetime) -> int:
    ts = crawl_ts.isoformat(sep=" ", timespec="seconds")
    cur = conn.cursor()

    cur.execute(_sql("""
        INSERT INTO crawls (crawl_timestamp)
        VALUES (?)
        ON CONFLICT(crawl_timestamp) DO UPDATE SET crawl_timestamp=excluded.crawl_timestamp
    """), (ts,))
    conn.commit()

    cur.execute(_sql("SELECT id FROM crawls WHERE crawl_timestamp = ?"), (ts,))
    return int(cur.fetchone()[0])


def upsert_products(conn, df_products: pd.DataFrame) -> Dict[str, int]:
    """
    Passt zu deinem Schema:
      products.name
      products.cardmarket_url
    Erwartet im CSV:
      df_products['url']
      df_products['product_name']
    Gibt Mapping zurück: {url -> product_id}
    """
    cur = conn.cursor()

    # 1) Upsert per cardmarket_url
    rows = []
    for _, r in df_products.iterrows():
        cm_url = str(r["url"])
        name = r.get("product_name", None)
        if pd.isna(name):
            name = None
        else:
            name = str(name).strip() or None
        rows.append((name, cm_url))

    cur.executemany(_sql("""
    INSERT INTO products (name, cardmarket_url, is_active)
    VALUES (?, ?, TRUE)
    ON CONFLICT(cardmarket_url) DO UPDATE SET
        name = excluded.name,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
"""), rows)
    conn.commit()

    # 2) Mapping url -> id laden
    urls = [str(u) for u in df_products["url"].unique().tolist()]
    if not urls:
        return {}

    if _IS_PG:
        placeholders = ",".join(["%s"] * len(urls))
    else:
        placeholders = ",".join(["?"] * len(urls))

    cur.execute(f"""
        SELECT id, cardmarket_url
        FROM products
        WHERE cardmarket_url IN ({placeholders})
    """, urls)

    return {row[1]: int(row[0]) for row in cur.fetchall()}


def insert_product_stats(conn, crawl_id: int, df_products: pd.DataFrame, url_to_pid: Dict[str, int]):
    cur = conn.cursor()
    rows = []
    for _, r in df_products.iterrows():
        url = str(r["url"])
        pid = url_to_pid.get(url)
        if not pid:
            continue
        rows.append((
            crawl_id,
            pid,
            int(r["available_items"]) if pd.notna(r.get("available_items", None)) else None,
            parse_eur_text(r.get("from_price", None)),
            parse_eur_text(r.get("price_trend", None)),
            parse_eur_text(r.get("avg_30d", None)),
            parse_eur_text(r.get("avg_7d", None)),
            parse_eur_text(r.get("avg_1d", None)),
        ))

    cur.executemany(_sql("""
        INSERT INTO product_stats (
            crawl_id, product_id, available_items,
            from_price, price_trend, avg_30d, avg_7d, avg_1d
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(crawl_id, product_id) DO UPDATE SET
            available_items = excluded.available_items,
            from_price = excluded.from_price,
            price_trend = excluded.price_trend,
            avg_30d = excluded.avg_30d,
            avg_7d = excluded.avg_7d,
            avg_1d = excluded.avg_1d
    """), rows)
    conn.commit()


def insert_offers(conn, crawl_id: int, df_offers: pd.DataFrame, url_to_pid: Dict[str, int]):
    cur = conn.cursor()
    rows = []
    for _, r in df_offers.iterrows():
        url = str(r["url"])
        pid = url_to_pid.get(url)
        if not pid:
            continue

        ship = r.get("shipping_price", None)
        ship = float(ship) if pd.notna(ship) else None

        total = r.get("total_price", None)
        total = float(total) if pd.notna(total) else None

        item_price = r.get("item_price", None)
        if pd.notna(item_price):
            item_price = float(item_price)
        else:
            item_price = parse_eur_text(r.get("price_text", None))

        comment = r.get("comment", None)
        comment = None if pd.isna(comment) else str(comment)

        ratings = r.get("ratings", None)
        ratings = int(ratings) if pd.notna(ratings) else None

        qty = r.get("qty", None)
        qty = int(qty) if pd.notna(qty) else None

        rows.append((
            crawl_id,
            pid,
            r.get("seller", None),
            ratings,
            comment,
            item_price,
            ship,
            total,
            qty,
            r.get("price_text", None),
            r.get("raw_cells", None),
        ))

    cur.executemany(_sql("""
        INSERT INTO offers (
            crawl_id, product_id, seller, ratings, comment,
            item_price, shipping_price, total_price, qty,
            price_text, raw_cells
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """), rows)
    conn.commit()


def _median(values: list) -> float:
    n = len(values)
    mid = n // 2
    return values[mid] if n % 2 else (values[mid - 1] + values[mid]) / 2


def compute_realistic_prices_for_crawl(conn, crawl_id: int):
    cur = conn.cursor()

    cur.execute(_sql("""
        SELECT product_id, total_price, comment
        FROM offers
        WHERE crawl_id = ? AND total_price IS NOT NULL
        ORDER BY product_id, total_price ASC
    """), (crawl_id,))

    by_product: Dict[int, List[tuple]] = {}
    for product_id, total_price, comment in cur.fetchall():
        by_product.setdefault(product_id, []).append((total_price, comment))

    n_keyword = n_adjusted = 0
    updates = []

    for product_id, offers in by_product.items():
        # 1) Keyword filter
        clean = []
        for price, comment in offers:
            if comment and any(kw in comment.lower() for kw in KEYWORD_BLACKLIST):
                n_keyword += 1
                continue
            clean.append(price)

        if not clean:
            updates.append((None, 0, crawl_id, product_id))
            continue

        # 2) Skip 2 cheapest, take up to 5.
        #    If too few clean offers, reduce skip to always keep at least 3 in window.
        clean = sorted(clean)
        skip = min(2, max(0, len(clean) - 3))
        if skip < 2:
            n_adjusted += 1
        window = clean[skip:skip + 5]
        realistic_price = _median(window)
        updates.append((realistic_price, len(window), crawl_id, product_id))

    cur.executemany(_sql("""
        UPDATE product_stats
        SET realistic_price = ?, offers_used = ?
        WHERE crawl_id = ? AND product_id = ?
    """), updates)
    conn.commit()

    print(f"[FILTER] keyword={n_keyword}, adjusted_skip={n_adjusted}")


def import_one_run(products_csv: Path, offers_csv: Path):
    dfp = read_csv_fallback(products_csv)
    dfo = read_csv_fallback(offers_csv)

    ts_p = str(dfp["crawl_timestamp"].iloc[0])
    ts_o = str(dfo["crawl_timestamp"].iloc[0])
    if ts_p != ts_o:
        raise RuntimeError(f"Timestamp mismatch: products={ts_p} offers={ts_o}")

    crawl_ts = datetime.fromisoformat(ts_p)

    conn = get_connection()
    try:
        ensure_tables(conn)
        crawl_id = upsert_crawl(conn, crawl_ts)
        url_to_pid = upsert_products(conn, dfp)
        insert_product_stats(conn, crawl_id, dfp, url_to_pid)
        insert_offers(conn, crawl_id, dfo, url_to_pid)
        print(f"[RUN] compute realistic_price for crawl_id={crawl_id}")
        compute_realistic_prices_for_crawl(conn, crawl_id)

        cur = conn.cursor()
        cur.execute(
            _sql("SELECT COUNT(*) FROM product_stats WHERE crawl_id=? AND realistic_price IS NOT NULL"),
            (crawl_id,)
        )
        print(f"[RUN] realistic_price filled rows: {cur.fetchone()[0]}")

    finally:
        conn.close()


def ensure_product_stats_columns(conn):
    """
    Für SQLite: fügt Spalten hinzu falls nicht vorhanden.
    Für PostgreSQL: no-op (Alembic-Migration enthält bereits die Spalten).
    """
    if _IS_PG:
        return

    cur = conn.cursor()
    cur.execute("PRAGMA table_info(product_stats);")
    cols = {row[1] for row in cur.fetchall()}

    if "realistic_price" not in cols:
        cur.execute("ALTER TABLE product_stats ADD COLUMN realistic_price REAL;")
    if "offers_used" not in cols:
        cur.execute("ALTER TABLE product_stats ADD COLUMN offers_used INTEGER;")

    conn.commit()


def main():
    new_dir = Path(__file__).parent / "data" / "new"
    processed_dir = Path(__file__).parent / "data" / "processed"
    failed_dir = Path(__file__).parent / "data" / "failed"

    new_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)
    failed_dir.mkdir(parents=True, exist_ok=True)

    pairs = find_run_pairs(new_dir)
    if not pairs:
        print("No new run pairs found in data/new.")
        return

    for run_key, p_csv, o_csv in pairs:
        try:
            print(f"Importing run {run_key} ...")
            import_one_run(p_csv, o_csv)

            shutil.move(str(p_csv), str(processed_dir / p_csv.name))
            shutil.move(str(o_csv), str(processed_dir / o_csv.name))
            print(f"✅ Imported + moved to processed: {run_key}")
        except Exception as e:
            print(f"❌ Failed run {run_key}: {e}")
            try:
                shutil.move(str(p_csv), str(failed_dir / p_csv.name))
            except Exception:
                pass
            try:
                shutil.move(str(o_csv), str(failed_dir / o_csv.name))
            except Exception:
                pass


if __name__ == "__main__":
    main()

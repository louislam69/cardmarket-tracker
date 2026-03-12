import os
import shutil
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# ==========================================================
# 1. DB-Verbindung
# ==========================================================
def get_connection():
    conn = psycopg2.connect(
        dbname="cardmarket",
        user="postgres",
        password="postgre8723",
        host="localhost",
        port=5432,
    )
    return conn

# ==========================================================
# Hilfsfunktionen
# ==========================================================
def parse_price(val):
    """Preis-String ('1.234,56 €') -> float oder None"""
    if pd.isna(val):
        return None
    s = str(val)
    s = s.replace("€", "").replace("EUR", "")
    s = s.replace(" ", "")
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None

def parse_reviews(val):
    """Reviews-String ('3.452') -> int oder None"""
    if pd.isna(val):
        return None
    s = str(val)
    s = s.replace(".", "").replace(",", "")
    try:
        return int(s)
    except ValueError:
        return None

def parse_int(val):
    if pd.isna(val):
        return None
    try:
        return int(val)
    except ValueError:
        return None

# ==========================================================
# 2. Eine einzelne Excel-Datei importieren
# ==========================================================
def import_file(conn, excel_path: str):
    print(f"\nStarte Import für: {excel_path}")
    df = pd.read_excel(excel_path)

    meta_cols = [
        "Current_time", "productname",
        "info1_1", "info2_2", "info3_3",
        "info4_4", "info5_5", "info6_6", "info7_7"
    ]
    df[meta_cols] = df[meta_cols].ffill()

    cur = conn.cursor()

    # --- Crawl anlegen / holen ---
    crawl_time = pd.to_datetime(df["Current_time"].dropna().iloc[0])

    cur.execute("""
        INSERT INTO crawls (crawled_at)
        VALUES (%s)
        ON CONFLICT (crawled_at) DO UPDATE SET crawled_at = EXCLUDED.crawled_at
        RETURNING id;
    """, (crawl_time,))
    crawl_id = cur.fetchone()[0]
    conn.commit()
    print(f"   ➤ Crawl-ID: {crawl_id} ({crawl_time})")

    # --- Produkte anlegen / aktualisieren ---
    product_names = df["productname"].dropna().unique()
    product_id_by_name = {}

    for name in product_names:
        cur.execute("""
            INSERT INTO products (name)
            VALUES (%s)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id;
        """, (name,))
        product_id_by_name[name] = cur.fetchone()[0]

    conn.commit()
    print(f"   ➤ Produkte angelegt/aktualisiert: {len(product_id_by_name)}")

    # --- Produkt-Stats pro Produkt & Crawl ---
    product_rows = (
        df.dropna(subset=["productname"])
          .drop_duplicates(subset=["Current_time", "productname"])
    )

    product_stats_data = []
    for _, row in product_rows.iterrows():
        name = row["productname"]
        pid = product_id_by_name[name]

        product_stats_data.append((
            pid,
            crawl_id,
            parse_int(row["info1_1"]),       # available_items
            parse_price(row["info2_2"]),     # from_price
            parse_price(row["info3_3"]),     # price_trend
            parse_price(row["info4_4"]),     # avg_30d
            parse_price(row["info5_5"]),     # avg_7d
            parse_price(row["info6_6"]),     # avg_1d
            parse_price(row["info7_7"]),     # extra_metric
        ))

    if product_stats_data:
        execute_values(cur, """
            INSERT INTO product_stats (
                product_id, crawl_id,
                available_items, from_price,
                price_trend, avg_30d, avg_7d, avg_1d,
                extra_metric
            )
            VALUES %s
            ON CONFLICT (product_id, crawl_id) DO UPDATE
            SET available_items = EXCLUDED.available_items,
                from_price      = EXCLUDED.from_price,
                price_trend     = EXCLUDED.price_trend,
                avg_30d         = EXCLUDED.avg_30d,
                avg_7d          = EXCLUDED.avg_7d,
                avg_1d          = EXCLUDED.avg_1d,
                extra_metric    = EXCLUDED.extra_metric;
        """, product_stats_data)
        conn.commit()
    print(f"   ➤ product_stats Zeilen: {len(product_stats_data)}")

    # --- Offers (Seller + Preis + Reviews) ---
    offers_df = df[df["seller_name"].notna()].copy()

    # alte Offers für diesen Crawl löschen, damit bei erneutem Import keine Duplikate entstehen
    cur.execute("DELETE FROM offers WHERE crawl_id = %s;", (crawl_id,))
    conn.commit()

    offers_data = []
    for _, row in offers_df.iterrows():
        name = row["productname"]
        pid = product_id_by_name.get(name)
        if pid is None:
            continue

        offers_data.append((
            pid,
            crawl_id,
            row["seller_name"],
            row.get("product_info", None),
            parse_price(row["price"]),
            parse_int(row["amount"]),
            parse_reviews(row.get("reviews", None))
        ))

    if offers_data:
        execute_values(cur, """
            INSERT INTO offers (
                product_id, crawl_id,
                seller_name, product_info,
                price, amount, seller_reviews
            )
            VALUES %s;
        """, offers_data)
        conn.commit()

    print(f"   ➤ Offers Zeilen: {len(offers_data)}")

    # --- realistischen Preis für diesen Crawl in product_stats eintragen ---
    cur.execute("""
        UPDATE product_stats ps
        SET realistic_price = r.realistic_avg_price
        FROM realistic_price_per_product_crawl r
        WHERE ps.product_id = r.product_id
          AND ps.crawl_id   = r.crawl_id
          AND ps.crawl_id   = %s;
    """, (crawl_id,))
    conn.commit()

    cur.close()
    print(f"✅ Import für {excel_path} abgeschlossen.")

# ==========================================================
# 3. Alle Dateien im "new"-Ordner importieren
# ==========================================================
def main():
    # Basisordner für die Imports
    base_folder = os.path.join(os.path.dirname(__file__), "data")
    new_folder = os.path.join(base_folder, "new")
    processed_folder = os.path.join(base_folder, "processed")

    # Ordner sicherstellen
    os.makedirs(new_folder, exist_ok=True)
    os.makedirs(processed_folder, exist_ok=True)

    print("Base Folder:     ", base_folder)
    print("New Folder:      ", new_folder)
    print("Processed Folder:", processed_folder)

    conn = get_connection()

    # ✅ Alle Excel-Dateien im NEW-Ordner finden (egal wie sie heißen)
    files = [
        f for f in os.listdir(new_folder)
        if f.lower().endswith(".xlsx")  # oder ".xls" mit dazu:
        # if f.lower().endswith((".xlsx", ".xls"))
    ]
    files = sorted(files)

    if not files:
        print("⚠️ Keine Excel-Dateien im 'new'-Ordner gefunden.")
        conn.close()
        return

    print("Folgende Dateien werden importiert:")
    for f in files:
        print("  -", f)

    for f in files:
        full_path = os.path.join(new_folder, f)
        import_file(conn, full_path)

        # Nach erfolgreichem Import: Datei nach processed verschieben
        dest_path = os.path.join(processed_folder, f)
        if os.path.exists(dest_path):
            os.remove(dest_path)  # ggf. alte Version überschreiben
        shutil.move(full_path, dest_path)
        print(f"   ➤ Verschoben nach: {dest_path}")

    conn.close()
    print("\nAlle Dateien importiert und verschoben.")


if __name__ == "__main__":
    main()

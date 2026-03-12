#!/usr/bin/env python3
"""
convert_excel_to_csv.py

Wandelt alte Excel-Crawl-Dateien in das products/offers CSV-Paar-Format um,
das import_csv_runs.py erwartet.

Verwendung:
    python convert_excel_to_csv.py                    # alle .xlsx in D:/Alte Crawls/
    python convert_excel_to_csv.py datei1.xlsx ...    # bestimmte Dateien
"""

import glob
import os
import sys

import pandas as pd

# ── Pfade ────────────────────────────────────────────────────────────────────
SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
PROCESSED_DIR = os.path.join(SCRIPT_DIR, "data", "processed")
OUTPUT_DIR    = os.path.join(SCRIPT_DIR, "data", "new")
EXCEL_DIR     = r"D:\Alte Crawls"


# ── Hilfsfunktionen ──────────────────────────────────────────────────────────
def build_url_map() -> dict[str, str]:
    """Liest alle prozessierten products-CSVs und baut ein Name→URL-Mapping."""
    url_map: dict[str, str] = {}
    for f in glob.glob(os.path.join(PROCESSED_DIR, "products_*.csv")):
        try:
            df = pd.read_csv(f)
            for _, row in df.iterrows():
                name = str(row["product_name"]).strip()
                url  = str(row["url"]).strip()
                if name and url:
                    url_map[name] = url
        except Exception as e:
            print(f"  ⚠ Konnte {f} nicht lesen: {e}")
    return url_map


def parse_price(val) -> float | None:
    """'1.234,56 €' oder '1234,56 €' → 1234.56, None bei Fehler."""
    if pd.isna(val):
        return None
    s = str(val).replace("€", "").replace("EUR", "").replace("\xa0", "").replace(" ", "")
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def parse_ratings(val) -> int | None:
    """'3.452', '2\\nK' (Excel-Multiline) oder '81' → int, None bei Fehler."""
    if pd.isna(val):
        return None
    s = str(val).strip()
    # "2\nK" → Zahl vor dem Zeilenumbruch extrahieren
    if "\n" in s:
        s = s.split("\n")[0].strip()
    # Trennzeichen entfernen
    s = s.replace(".", "").replace(",", "")
    # "K"-Suffix (Tausend)
    if s.upper().endswith("K"):
        try:
            return int(float(s[:-1]) * 1000)
        except ValueError:
            return None
    try:
        return int(s)
    except ValueError:
        return None


def make_raw_cells(ratings, seller: str, comment, price_text: str, qty: int) -> str:
    """Erzeugt eine raw_cells-Spalte im pipe-Format (ohne Versandpreis)."""
    r = "" if pd.isna(ratings) else str(ratings)
    c = "" if pd.isna(comment)  else str(comment)
    return f"{r} | - | {seller} | {c} | {price_text} | 0,00 € | {qty}"


# ── Konvertierung einer Datei ────────────────────────────────────────────────
def convert(excel_path: str, url_map: dict, output_dir: str) -> None:
    print(f"\nVerarbeite: {excel_path}")
    df = pd.read_excel(excel_path)

    # Hierarchische Meta-Spalten nach unten füllen
    meta_cols = [
        "Current_time", "productname",
        "info1_1", "info2_2", "info3_3",
        "info4_4", "info5_5", "info6_6",
    ]
    df[meta_cols] = df[meta_cols].ffill()

    # Crawl-Zeitstempel bestimmen
    raw_time = df["Current_time"].dropna().iloc[0]
    ts       = pd.to_datetime(raw_time)
    iso_ts   = ts.strftime("%Y-%m-%dT%H:%M:%S")
    file_ts  = ts.strftime("%Y-%m-%d_%H%M%S")

    # ── Products CSV ────────────────────────────────────────────────────────
    product_rows = (
        df.dropna(subset=["productname"])
          .drop_duplicates(subset=["productname"])
    )

    products_data = []
    missing_urls  = []

    for _, row in product_rows.iterrows():
        name = str(row["productname"]).strip()
        url  = url_map.get(name)
        if url is None:
            missing_urls.append(name)
            continue

        available = row["info1_1"]
        try:
            available = int(available) if pd.notna(available) else ""
        except (ValueError, TypeError):
            available = ""

        products_data.append({
            "crawl_timestamp": iso_ts,
            "url":             url,
            "product_name":    name,
            "available_items": available,
            "from_price":      row["info2_2"] if pd.notna(row["info2_2"]) else "",
            "price_trend":     row["info3_3"] if pd.notna(row["info3_3"]) else "",
            "avg_30d":         row["info4_4"] if pd.notna(row["info4_4"]) else "",
            "avg_7d":          row["info5_5"] if pd.notna(row["info5_5"]) else "",
            "avg_1d":          row["info6_6"] if pd.notna(row["info6_6"]) else "",
        })

    if missing_urls:
        print(f"  ⚠ Keine URL gefunden für {len(missing_urls)} Produkte:")
        for m in missing_urls:
            print(f"     - {m}")

    df_products  = pd.DataFrame(products_data)
    out_products = os.path.join(output_dir, f"products_{file_ts}.csv")
    df_products.to_csv(out_products, index=False)
    print(f"  OK products: {out_products}  ({len(df_products)} Zeilen)")

    # ── Offers CSV ──────────────────────────────────────────────────────────
    name_to_url = {
        str(row["productname"]).strip(): url_map.get(str(row["productname"]).strip())
        for _, row in product_rows.iterrows()
    }

    offers_df   = df[df["seller_name"].notna()].copy()
    offers_data = []

    for _, row in offers_df.iterrows():
        name = str(row["productname"]).strip()
        url  = name_to_url.get(name)
        if url is None:
            continue

        item_price = parse_price(row["price"])
        ratings    = parse_ratings(row.get("reviews"))
        comment    = row.get("product_info")
        qty_raw    = row.get("amount")
        try:
            qty = int(qty_raw) if pd.notna(qty_raw) else 1
        except (ValueError, TypeError):
            qty = 1

        price_text = str(row["price"]).strip() if pd.notna(row["price"]) else ""
        raw_cells  = make_raw_cells(ratings, row["seller_name"], comment, price_text, qty)

        offers_data.append({
            "crawl_timestamp": iso_ts,
            "url":             url,
            "seller":          row["seller_name"],
            "ratings":         ratings if ratings is not None else "",
            "comment":         "" if pd.isna(comment) else str(comment),
            "item_price":      item_price if item_price is not None else "",
            "shipping_price":  0.0,
            "total_price":     item_price if item_price is not None else "",
            "qty":             qty,
            "price_text":      price_text,
            "raw_cells":       raw_cells,
        })

    df_offers  = pd.DataFrame(offers_data)
    out_offers = os.path.join(output_dir, f"offers_{file_ts}.csv")
    df_offers.to_csv(out_offers, index=False)
    print(f"  OK offers:   {out_offers}  ({len(df_offers)} Zeilen)")


# ── Einstiegspunkt ───────────────────────────────────────────────────────────
def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    url_map = build_url_map()
    print(f"URL-Mapping geladen: {len(url_map)} Produkte")

    if len(sys.argv) > 1:
        files = sys.argv[1:]
    else:
        files = sorted(glob.glob(os.path.join(EXCEL_DIR, "*.xlsx")))

    if not files:
        print(f"Keine .xlsx-Dateien gefunden in: {EXCEL_DIR}")
        return

    print(f"Zu konvertierende Dateien: {len(files)}")
    for f in files:
        convert(f, url_map, OUTPUT_DIR)

    print(f"\nFertig! Jetzt 'python import_csv_runs.py' ausführen zum Importieren.")


if __name__ == "__main__":
    main()

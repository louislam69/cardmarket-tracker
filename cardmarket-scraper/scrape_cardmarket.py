import re
import csv
import sys
import random
import time
from datetime import datetime
import json
from pathlib import Path
from typing import Dict, List, Optional

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError

BASE_TIMEOUT_MS = 45_000

# Stabilität/Anti-Block: zufällige Pausen zwischen URLs
MIN_DELAY_S = 8
MAX_DELAY_S = 14

# Wie oft pro URL erneut versuchen (zusätzlich zum ersten Versuch)
RETRY_PER_URL = 2

EURO_RE = re.compile(r"(\d+[.,]\d+)\s*€")


def read_urls(path: str) -> List[str]:
    p = Path(path)
    urls: List[str] = []
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            urls.append(line)
    return urls


def normalize_price(text: str) -> Optional[float]:
    m = EURO_RE.search((text or "").replace("\xa0", " "))
    if not m:
        return None
    v = m.group(1).replace(".", "").replace(",", ".")
    try:
        return float(v)
    except ValueError:
        return None


def parse_int_safe(s: str) -> Optional[int]:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return int(s)
    except ValueError:
        return None


def get_product_title(page) -> str:
    h1 = page.locator("h1").first
    if h1.count():
        t = h1.inner_text().strip()
        if t:
            return t.splitlines()[0].strip()
    return page.title()

def parse_price_eur(s: str) -> float | None:
    if s is None:
        return None
    s = str(s).replace("€", "").replace(" ", "").strip()
    s = s.replace(".", "")      # Tausenderpunkt killen
    s = s.replace(",", ".")     # Dezimal-Komma
    try:
        return float(s)
    except ValueError:
        return None


def is_cloudflare_check(page) -> bool:
    return (
        page.locator("text=Bestätigen Sie, dass Sie ein Mensch sind").first.count() > 0
        or page.locator("text=Confirm you are human").first.count() > 0
        or page.locator("text=Verify you are human").first.count() > 0
        or page.locator("text=Checking your browser").first.count() > 0
        or page.locator("text=security check").first.count() > 0
    )


def save_storage(context, path: str):
    context.storage_state(path=path)


def ensure_human_check_and_persist(page, context, storage_path: Path):
    """
    Wenn Cloudflare/Captcha sichtbar ist:
    - du löst es manuell
    - ENTER drücken
    - DANN speichern wir sofort storage_state.json (Challenge-Cookies landen direkt in der Session)
    """
    if is_cloudflare_check(page):
        print("⚠️ Cloudflare/Captcha erkannt. Bitte im Browser lösen, dann ENTER drücken.")
        input("ENTER...")
        # Kurze Pause, damit Cookies/Redirects sauber durch sind
        try:
            page.wait_for_load_state("domcontentloaded", timeout=15_000)
        except Exception:
            pass
        time.sleep(1.0)
        save_storage(context, str(storage_path))
        print(f"✅ Session aktualisiert (Captcha-Cookies gespeichert): {storage_path.resolve()}")


def parse_product_info_block(page) -> Dict[str, str]:
    """
    Cardmarket Info-Block ist ein <dl> mit <dt>Label</dt> und <dd>Value</dd>.
    Wir lesen alle dt/dd-Paare aus dem passenden dl und bauen ein Dict Label->Value.
    Funktioniert stabil in DE/EN, weil wir die Labels nicht erzwingen – wir lesen alles.
    """

    # Finde das richtige <dl>, indem wir nach typischen dt-Labels suchen
    # (in deinem Screenshot: "Verfügbare Artikel", "ab", "Preis-Trend", "30-Tages-Durchschnitt" ...)
    dt_anchor = (
        page.locator("dt", has_text="Available items").first
        if page.locator("dt", has_text="Available items").count() > 0
        else page.locator("dt", has_text="Verfügbare Artikel").first
    )

    if dt_anchor.count() == 0:
        # Fallback: über andere bekannte Labels versuchen
        for t in ["From", "ab", "Price Trend", "Preis-Trend", "30-days", "30-Tages"]:
            cand = page.locator("dt", has_text=t).first
            if cand.count() > 0:
                dt_anchor = cand
                break

    if dt_anchor.count() == 0:
        return {}

    dl = dt_anchor.locator("xpath=ancestor::dl[1]").first
    if dl.count() == 0:
        return {}

    info: Dict[str, str] = {}
    dts = dl.locator("dt")
    for i in range(dts.count()):
        dt = dts.nth(i)
        label = dt.inner_text().replace("\xa0", " ").strip()
        if not label:
            continue

        dd = dt.locator("xpath=following-sibling::dd[1]")
        value = "–"
        if dd.count() > 0:
            value = dd.first.inner_text().replace("\xa0", " ").strip()
            if not value:
                value = "–"

        info[label] = value

    return info


def parse_offer_raw_cells(raw_cells: str, seller: str = "") -> Dict:
    """
    Robust:
    - ratings = erste int-Zahl (Bewertungen)
    - delivery time wird ignoriert
    - qty = letzte int-Zahl
    - item/shipping = letzte zwei €-Beträge
    - comment = Text zwischen seller-Teil und erstem Preis (falls vorhanden)
    - wenn comment == seller => comment leer
    """
    parts = [p.strip() for p in (raw_cells or "").split("|")]
    parts = [p for p in parts if p != ""]

    seller = (seller or "").strip()

    # ratings = erster int
    ratings = None
    for p in parts:
        v = parse_int_safe(p)
        if v is not None:
            ratings = v
            break

    # qty = letzter int
    qty = None
    for p in reversed(parts):
        v = parse_int_safe(p)
        if v is not None:
            qty = v
            break

    # finde alle €-Beträge inkl. Index
    euro_hits = []
    for idx, p in enumerate(parts):
        val = normalize_price(p)
        if val is not None:
            euro_hits.append((idx, p, val))

    item_price = shipping_price = total_price = None
    item_price_txt = shipping_txt = ""
    first_price_idx = None

    if len(euro_hits) >= 2:
        (i_idx, i_txt, i_val) = euro_hits[-2]
        (_, s_txt, s_val) = euro_hits[-1]
        item_price = round(i_val, 2)
        shipping_price = round(s_val, 2)
        item_price_txt = i_txt
        shipping_txt = s_txt
        total_price = round(item_price + shipping_price, 2)
        first_price_idx = i_idx
    elif len(euro_hits) == 1:
        (i_idx, i_txt, i_val) = euro_hits[-1]
        item_price = round(i_val, 2)
        item_price_txt = i_txt
        total_price = item_price
        first_price_idx = i_idx

    # comment: typischerweise ab Index 3 (ratings | delivery | seller | comment... | prices...)
    comment = ""
    if first_price_idx is not None:
        mid_start = 3
        mid_end = max(mid_start, first_price_idx)
        if len(parts) > mid_start and mid_end > mid_start:
            comment = " ".join(parts[mid_start:mid_end]).strip()

    # cleanup: wenn comment == seller, dann ist es kein Kommentar
    if comment and seller and comment.strip().lower() == seller.strip().lower():
        comment = ""

    return {
        "ratings": ratings,
        "comment": comment,
        "item_price": item_price,
        "shipping_price": shipping_price,
        "total_price": total_price,
        "qty": qty,
        "item_price_text": item_price_txt,
        "shipping_text": shipping_txt,
    }


def parse_offers(page) -> List[Dict]:
    """
    Findet Offers über Seller-Links (/Users/) + Block mit €.
    Dedupe stabiler: seller + (item_price, shipping, qty) + snippet.
    """
    offers: List[Dict] = []
    seen = set()

    # Offers-Bereich grob eingrenzen
    heading = page.locator("text=Available items").first
    if heading.count() == 0:
        heading = page.locator("text=Verfügbare Artikel").first

    scope = page
    if heading.count() > 0:
        scope = heading.locator("xpath=ancestor::*[self::main or self::section or self::div][1]")

    seller_links = scope.locator('a[href*="/Users/"]')
    if seller_links.count() == 0:
        seller_links = page.locator('a[href*="/Users/"]')

    for i in range(seller_links.count()):
        link = seller_links.nth(i)
        seller = link.inner_text().strip()
        if not seller:
            continue

        handle = link.element_handle()
        if not handle:
            continue

        row_handle = handle.evaluate_handle(
            """
            (el) => {
              let cur = el;
              for (let i = 0; i < 10; i++) {
                cur = cur.parentElement;
                if (!cur) break;
                const t = (cur.innerText || "").trim();
                if (t.includes("€") && t.length < 1600) return cur;
              }
              return null;
            }
            """
        ).as_element()

        if not row_handle:
            continue

        row_text = (row_handle.inner_text() or "").strip()
        if not row_text:
            continue

        # Lines sauber machen (verhindert komische Steuerzeichen / zusammengeklebte Ausgabe)
        lines = [l.strip() for l in row_text.splitlines() if l.strip()]
        lines = [l.replace("\r", " ").replace("\n", " ").strip() for l in lines]

        # Preis/Versand/Qty als Dedupe-Anker
        euro_vals = [normalize_price(l) for l in lines]
        euro_vals = [e for e in euro_vals if e is not None]
        item_val = ship_val = None
        if len(euro_vals) >= 2:
            item_val, ship_val = euro_vals[-2], euro_vals[-1]
        elif len(euro_vals) == 1:
            item_val, ship_val = euro_vals[-1], None

        qty_val = None
        for l in reversed(lines):
            iv = parse_int_safe(l)
            if iv is not None:
                qty_val = iv
                break

        snippet = " | ".join(lines[:10])
        key = (seller, item_val, ship_val, qty_val, snippet)
        if key in seen:
            continue
        seen.add(key)

        # Preistext: nimm das erste gefundene €-Line (nur für Anzeige/Backup)
        price_txt = ""
        price_val = None
        for l in lines:
            p = normalize_price(l)
            if p is not None:
                price_txt = l
                price_val = p
                break

        offers.append(
            {
                "seller": seller,
                "price_text": price_txt,
                "price": price_val,
                "raw_cells": " | ".join(lines),
            }
        )

    return offers


def launch_visible():
    pw = sync_playwright().start()
    browser = pw.chromium.launch(
        headless=False,
        slow_mo=150,
        args=["--disable-blink-features=AutomationControlled"],
    )
    context = browser.new_context()
    return pw, browser, context


def main():
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--urls", default="urls.txt")
    ap.add_argument("--storage", default="storage_state.json")
    # Output
    # Wenn du nichts angibst, erstellen wir pro Crawl-Run neue Dateien mit Datum+Uhrzeit im Namen.
    ap.add_argument("--out-dir", default=str(Path(__file__).parent.parent / "cardmarket-backend" / "data" / "new"), help="Zielordner für Crawl-Ergebnisse")
    ap.add_argument("--run-tag", default="", help="Optionaler Suffix für Dateinamen (z.B. 'test')")
    ap.add_argument("--out-products", default="products.csv", help="Pfad/Name für Products-CSV (optional)")
    ap.add_argument("--out-offers", default="offers.csv", help="Pfad/Name für Offers-CSV (optional)")
    ap.add_argument("--setup", action="store_true",
                    help="Öffnet Cardmarket zum manuellen Login und speichert Session (storage_state).")
    ap.add_argument("--limit", type=int, default=0,
                    help="Nur die ersten N URLs crawlen (0 = alle).")
    args = ap.parse_args()

    storage_path = Path(args.storage)

    # 1) Setup-Run: manuell Login, dann Session speichern
    if args.setup:
        pw, browser, context = launch_visible()
        page = context.new_page()
        page.set_default_timeout(BASE_TIMEOUT_MS)

        page.goto(
            "https://www.cardmarket.com/en/Pokemon/Products/Booster-Boxes/Fusion-Strike-Booster-Box",
            wait_until="domcontentloaded",
        )

        print("\n✅ Browser ist offen.")
        print("1) Logge dich in Cardmarket ein")
        print("2) Wenn Captcha kommt: lösen")
        print("3) Danach zu irgendeiner Produktseite gehen")
        print("\nDann zurück hierher und ENTER drücken, um die Session zu speichern.\n")
        input("ENTER zum Speichern...")

        save_storage(context, str(storage_path))
        print(f"✅ Gespeichert: {storage_path.resolve()}")

        context.close()
        browser.close()
        pw.stop()
        return

    # 2) Crawl-Run
    if not storage_path.exists():
        print(f"❌ storage_state fehlt: {storage_path}. Erst --setup ausführen.")
        sys.exit(1)

    urls = read_urls(args.urls)
    if not urls:
        print("❌ Keine URLs gefunden.")
        sys.exit(1)

    if args.limit and args.limit > 0:
        urls = urls[: args.limit]
        print(f"ℹ️ Testlauf: limit={args.limit} -> {len(urls)} URLs")

    # --- Output pro Crawl-Run eindeutig machen (Datum/Uhrzeit im Namen) ---
    run_stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    run_tag = (args.run_tag or "").strip()
    tag_suffix = f"_{run_tag}" if run_tag else ""

    out_root = Path(args.out_dir)
    out_root.mkdir(parents=True, exist_ok=True)

    def resolve_out_path(user_value: str, kind: str) -> Path:
        p = Path(user_value)
        # Wenn User einen Pfad inkl. Ordner angibt -> respektieren
        if p.parent != Path("."):
            return p

        stem = p.stem or kind
        # FLACH in out_root speichern (data/new)
        return out_root / f"{stem}_{run_stamp}.csv"


    out_products_path = resolve_out_path(args.out_products, "products")
    out_offers_path = resolve_out_path(args.out_offers, "offers")

    # Meta-Info zum Run (optional, aber praktisch)
    meta = {
        "run_stamp": run_stamp,
        "run_tag": run_tag,
        "started_at": datetime.now().isoformat(timespec="seconds"),
        "urls_count": len(urls),
        "out_products": str(out_products_path),
        "out_offers": str(out_offers_path),
    }
    (out_root / f"run_meta_{run_stamp}{tag_suffix}.json").write_text(
    json.dumps(meta, ensure_ascii=False, indent=2),
    encoding="utf-8")


    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=False,
            slow_mo=120,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(storage_state=str(storage_path))
        page = context.new_page()
        page.set_default_timeout(BASE_TIMEOUT_MS)

        products_f = open(out_products_path, "w", newline="", encoding="utf-8")
        offers_f = open(out_offers_path, "w", newline="", encoding="utf-8")

        crawl_timestamp = datetime.now().isoformat(timespec="seconds")

        # Reihenfolge: available items, from, price trend, avg30, avg7, avg1
        prod_w = csv.DictWriter(
            products_f,
            fieldnames=[
                "crawl_timestamp",
                "url",
                "product_name",
                "available_items",
                "from_price",
                "price_trend",
                "avg_30d",
                "avg_7d",
                "avg_1d",
            ],
        )
        off_w = csv.DictWriter(
            offers_f,
            fieldnames=[
                "crawl_timestamp",
                "url",
                "seller",
                "ratings",
                "comment",
                "item_price",
                "shipping_price",
                "total_price",
                "qty",
                "price_text",
                "raw_cells",
            ],
        )
        prod_w.writeheader()
        off_w.writeheader()

        for idx, url in enumerate(urls, start=1):
            print(f"\n[{idx}/{len(urls)}] {url}")

            success = False
            last_err = None

            for attempt in range(1, RETRY_PER_URL + 2):
                try:
                    page.goto(url, wait_until="domcontentloaded")
                    try:
                        page.wait_for_load_state("networkidle", timeout=10_000)
                    except Exception:
                        pass

                    # Captcha/Cloudflare: lösen + direkt Session speichern
                    ensure_human_check_and_persist(page, context, storage_path)

                    time.sleep(1.2)

                    product_name = get_product_title(page)
                    info = parse_product_info_block(page)

                    # DE/EN Labels abfangen
                    available_items = info.get("Available items") or info.get("Verfügbare Artikel") or "–"
                    from_price      = info.get("From") or info.get("ab") or info.get("Ab") or "–"
                    price_trend     = info.get("Price Trend") or info.get("Preis-Trend") or info.get("Preistrend") or "–"

                    avg_30d = info.get("30-days average price") or info.get("30-Tages-Durchschnitt") or "–"
                    avg_7d  = info.get("7-days average price")  or info.get("7-Tages-Durchschnitt")  or "–"
                    avg_1d  = info.get("1-day average price")   or info.get("1-Tages-Durchschnitt")  or "–"


                    prod_w.writerow(
                        {
                            "crawl_timestamp": crawl_timestamp,
                            "url": url,
                            "product_name": product_name,
                            "available_items": available_items,
                            "from_price": from_price,
                            "price_trend": price_trend,
                            "avg_30d": avg_30d,
                            "avg_7d": avg_7d,
                            "avg_1d": avg_1d,
                        }
                    )
                    products_f.flush()

                    offers = parse_offers(page)
                    print(f"  -> Offers gefunden: {len(offers)}")

                    for o in offers:
                        parsed = parse_offer_raw_cells(o.get("raw_cells", ""), o.get("seller", ""))
                        off_w.writerow(
                            {
                                "crawl_timestamp": crawl_timestamp,
                                "url": url,
                                "seller": o.get("seller"),
                                "ratings": parsed.get("ratings"),
                                "comment": parsed.get("comment", ""),
                                "item_price": parsed.get("item_price"),
                                "shipping_price": parsed.get("shipping_price"),
                                "total_price": parsed.get("total_price"),
                                "qty": parsed.get("qty"),
                                "price_text": parsed.get("item_price_text", "") or o.get("price_text", ""),
                                "raw_cells": o.get("raw_cells", ""),
                            }
                        )
                    offers_f.flush()

                    # Optional: nach jedem erfolgreichen Produkt einmal Session auffrischen
                    # (hilft manchmal gegen erneute Captchas bei längeren Runs)
                    save_storage(context, str(storage_path))

                    success = True
                    break

                except PWTimeoutError as e:
                    last_err = e
                    print(f"❌ Timeout (Attempt {attempt}). Screenshot wird gespeichert.")
                    page.screenshot(path=f"timeout_{idx}_a{attempt}.png", full_page=True)

                except Exception as e:
                    last_err = e
                    print(f"❌ Fehler (Attempt {attempt}): {e}")
                    page.screenshot(path=f"error_{idx}_a{attempt}.png", full_page=True)

                backoff = random.uniform(4, 8) * attempt
                print(f"⏳ Warte {backoff:.1f}s vor Retry...")
                time.sleep(backoff)

            if not success:
                print(f"❌ URL dauerhaft fehlgeschlagen: {url} | Letzter Fehler: {last_err}")

            delay = random.uniform(MIN_DELAY_S, MAX_DELAY_S)
            print(f"⏳ Pause {delay:.1f}s...")
            time.sleep(delay)

        products_f.close()
        offers_f.close()

        print("\n✅ Fertig. CSVs geschrieben:")
        print("  Products:", str(out_products_path))
        print("  Offers:  ", str(out_offers_path))
        print(" Meta:    ", str(out_root / f"run_meta_{run_stamp}{tag_suffix}.json"))


        context.close()
        browser.close()


if __name__ == "__main__":
    main()

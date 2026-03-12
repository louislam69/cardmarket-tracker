import { useEffect, useState } from "react";
import {
  fetchLatestPrices,
  type LatestPricesResponse,
  type LatestPriceItem,
} from "../api/insights";
import ProductDetailModal from "../components/ui/ProductDetailModal";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return "–";
  return value.toFixed(2) + " €";
}

function formatDate(value: string): string {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("de-DE");
}

export default function ProductsPage() {
  const [data, setData] = useState<LatestPricesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const [selectedProduct, setSelectedProduct] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchLatestPrices(
      limit,
      offset,
      search || undefined,
      minPrice !== "" ? Number(minPrice) : undefined,
      maxPrice !== "" ? Number(maxPrice) : undefined,
    )
      .then(setData)
      .catch((err) => {
        console.error(err);
        setError("Fehler beim Laden der Produkte");
      })
      .finally(() => setLoading(false));
  }, [limit, offset, search, minPrice, maxPrice]);

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ marginBottom: "8px" }}>Produkte</h1>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Suche nach Produkt…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "4px", minWidth: "220px" }}
        />
        <input
          type="number"
          placeholder="Min €"
          value={minPrice}
          onChange={(e) => { setMinPrice(e.target.value); setOffset(0); }}
          style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "4px", width: "90px" }}
        />
        <input
          type="number"
          placeholder="Max €"
          value={maxPrice}
          onChange={(e) => { setMaxPrice(e.target.value); setOffset(0); }}
          style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "4px", width: "90px" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.875rem" }}>
          Einträge:
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
            style={{ padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: "4px" }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>
          {offset + 1}–{Math.min(offset + limit, data?.total ?? 0)} von {data?.total ?? 0}
        </span>
      </div>

      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}
      {loading && <div style={{ color: "#6b7280" }}>Lade Produkte…</div>}

      {!loading && data && data.items.length === 0 && (
        <div style={{ color: "#6b7280" }}>Keine Produkte gefunden.</div>
      )}

      {!loading && data && data.items.length > 0 && (
        <>
          <p style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "6px" }}>
            Zeile anklicken für Preishistorie, Angebots-Verteilung und Kaufsignal.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left", padding: "8px 10px" }}>Produkt</th>
                <th style={{ borderBottom: "2px solid #e5e7eb", textAlign: "right", padding: "8px 10px" }}>Ab €</th>
                <th style={{ borderBottom: "2px solid #e5e7eb", textAlign: "right", padding: "8px 10px" }}>Realist. €</th>
                <th style={{ borderBottom: "2px solid #e5e7eb", textAlign: "right", padding: "8px 10px" }}>Trend €</th>
                <th style={{ borderBottom: "2px solid #e5e7eb", textAlign: "right", padding: "8px 10px" }}>Ø 30d</th>
                <th style={{ borderBottom: "2px solid #e5e7eb", textAlign: "right", padding: "8px 10px" }}>Ø 7d</th>
                <th style={{ borderBottom: "2px solid #e5e7eb", textAlign: "right", padding: "8px 10px" }}>Ø 1d</th>
                <th style={{ borderBottom: "2px solid #e5e7eb", textAlign: "right", padding: "8px 10px" }}>Letzter Crawl</th>
                <th style={{ borderBottom: "2px solid #e5e7eb", textAlign: "right", padding: "8px 10px" }}>Angebote</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: LatestPriceItem) => (
                <tr
                  key={item.product_id}
                  onClick={() => setSelectedProduct({ id: item.product_id, name: item.product_name })}
                  style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f9ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <td style={{ padding: "7px 10px" }}>{item.product_name}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>{formatPrice(item.from_price)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600 }}>{formatPrice(item.realistic_price)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>{formatPrice(item.price_trend)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>{formatPrice(item.avg_30d)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>{formatPrice(item.avg_7d)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>{formatPrice(item.avg_1d)}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: "#6b7280", fontSize: "0.8rem" }}>
                    {formatDate(item.last_crawled_at)}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: "#6b7280" }}>
                    {item.offers_used ?? "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              style={{ padding: "4px 12px", borderRadius: "4px", border: "1px solid #d1d5db", cursor: "pointer" }}
            >
              ← Zurück
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={!data || offset + limit >= data.total}
              style={{ padding: "4px 12px", borderRadius: "4px", border: "1px solid #d1d5db", cursor: "pointer" }}
            >
              Weiter →
            </button>
          </div>
        </>
      )}

      <ProductDetailModal
        productId={selectedProduct?.id ?? null}
        productName={selectedProduct?.name ?? ""}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}

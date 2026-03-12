import { useEffect, useState } from "react";
import { fetchVolatility, type VolatilityItem } from "../api/insights";

function CvBadge({ cv }: { cv: number }) {
  let label: string;
  let color: string;
  let bg: string;
  if (cv >= 20) {
    label = "Hoch volatil";
    color = "#b91c1c";
    bg = "#fee2e2";
  } else if (cv >= 10) {
    label = "Mittel";
    color = "#92400e";
    bg = "#fef3c7";
  } else {
    label = "Stabil";
    color = "#15803d";
    bg = "#dcfce7";
  }
  return (
    <span style={{ backgroundColor: bg, color, padding: "2px 8px", borderRadius: "10px", fontWeight: 600, fontSize: "0.78rem" }}>
      {label}
    </span>
  );
}

export default function VolatilityPage() {
  const [items, setItems] = useState<VolatilityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchVolatility(limit, offset, search || undefined)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [limit, offset, search]);

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ marginBottom: "4px" }}>Volatilität</h1>
      <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "16px" }}>
        Produkte mit den größten Preisschwankungen – sortiert nach Variationskoeffizient (CV).
        Nur Produkte mit ≥ 3 Crawls. Hohe CV = potenzielle Handelschance.
      </p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Suche nach Produkt…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "4px", minWidth: "220px" }}
        />
        <select
          value={limit}
          onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
          style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "4px" }}
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} pro Seite</option>
          ))}
        </select>
        <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>{total} Produkte</span>
      </div>

      {loading ? (
        <div style={{ color: "#6b7280" }}>Lade…</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Produkt", "Ø Preis €", "StdAbw €", "CV %", "Min €", "Max €", "Spanne €", "Crawls", "Einschätzung"].map((h) => (
                <th key={h} style={{ textAlign: h === "Produkt" ? "left" : "right", padding: "8px 12px", borderBottom: "2px solid #e5e7eb" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.product_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "7px 12px" }}>{item.product_name}</td>
                <td style={{ textAlign: "right", padding: "7px 12px" }}>{item.avg_realistic_price.toFixed(2)}</td>
                <td style={{ textAlign: "right", padding: "7px 12px" }}>{item.stddev_price.toFixed(2)}</td>
                <td style={{ textAlign: "right", padding: "7px 12px", fontWeight: 700 }}>{item.cv.toFixed(1)}</td>
                <td style={{ textAlign: "right", padding: "7px 12px" }}>{item.min_price.toFixed(2)}</td>
                <td style={{ textAlign: "right", padding: "7px 12px" }}>{item.max_price.toFixed(2)}</td>
                <td style={{ textAlign: "right", padding: "7px 12px" }}>{item.price_range.toFixed(2)}</td>
                <td style={{ textAlign: "right", padding: "7px 12px", color: "#6b7280" }}>{item.crawl_count}</td>
                <td style={{ textAlign: "right", padding: "7px 12px" }}>
                  <CvBadge cv={item.cv} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: "flex", gap: "8px", marginTop: "12px", alignItems: "center" }}>
        <button
          onClick={() => setOffset(Math.max(0, offset - limit))}
          disabled={offset === 0}
          style={{ padding: "4px 12px", borderRadius: "4px", border: "1px solid #d1d5db", cursor: "pointer" }}
        >
          ← Zurück
        </button>
        <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
          {offset + 1}–{Math.min(offset + limit, total)} von {total}
        </span>
        <button
          onClick={() => setOffset(offset + limit)}
          disabled={offset + limit >= total}
          style={{ padding: "4px 12px", borderRadius: "4px", border: "1px solid #d1d5db", cursor: "pointer" }}
        >
          Weiter →
        </button>
      </div>
    </div>
  );
}

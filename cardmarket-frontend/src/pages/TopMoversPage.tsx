import { useEffect, useState } from "react";
import { fetchTopMovers, type TopMoverItem } from "../api/insights";

type Direction = "up" | "down" | "both";

export default function TopMoversPage() {
  const [items, setItems] = useState<TopMoverItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<Direction>("both");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchTopMovers(limit, offset, direction, 0, search || undefined)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [limit, offset, direction, search]);

  const fmt = (v: number) => v.toFixed(2) + " €";
  const fmtPct = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(1) + " %";
  const green = "#15803d";
  const red = "#b91c1c";

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ marginBottom: "4px" }}>Top Movers</h1>
      <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "16px" }}>
        Größte Preisänderungen zwischen letztem und vorletztem Crawl.
      </p>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Suche nach Produkt…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "4px", minWidth: "220px" }}
        />
        <select
          value={direction}
          onChange={(e) => { setDirection(e.target.value as Direction); setOffset(0); }}
          style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "4px" }}
        >
          <option value="both">Alle Richtungen</option>
          <option value="up">Nur Gewinner ▲</option>
          <option value="down">Nur Verlierer ▼</option>
        </select>
        <select
          value={limit}
          onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
          style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "4px" }}
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} pro Seite</option>
          ))}
        </select>
        <span style={{ color: "#6b7280", fontSize: "0.875rem" }}>{total} Einträge</span>
      </div>

      {loading ? (
        <div style={{ color: "#6b7280" }}>Lade…</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Produkt", "Letzter Preis", "Vorheriger Preis", "Änderung €", "Änderung %", "Letzter Crawl"].map((h) => (
                <th key={h} style={{ textAlign: h === "Produkt" ? "left" : "right", padding: "8px 12px", borderBottom: "2px solid #e5e7eb" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const color = item.rel_change_pct >= 0 ? green : red;
              return (
                <tr key={item.product_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "7px 12px" }}>{item.product_name}</td>
                  <td style={{ textAlign: "right", padding: "7px 12px" }}>{fmt(item.last_price)}</td>
                  <td style={{ textAlign: "right", padding: "7px 12px" }}>{fmt(item.prev_price)}</td>
                  <td style={{ textAlign: "right", padding: "7px 12px", color }}>{(item.abs_change >= 0 ? "+" : "") + item.abs_change.toFixed(2)} €</td>
                  <td style={{ textAlign: "right", padding: "7px 12px", color, fontWeight: 700 }}>{fmtPct(item.rel_change_pct)}</td>
                  <td style={{ textAlign: "right", padding: "7px 12px", color: "#6b7280", fontSize: "0.8rem" }}>
                    {new Date(item.last_crawled_at).toLocaleDateString("de-DE")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Pagination */}
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

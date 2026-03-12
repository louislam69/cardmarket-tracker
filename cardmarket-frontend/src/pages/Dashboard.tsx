import { useEffect, useState } from "react";
import { fetchSummary, fetchSetSummary, type SummaryStats, type SetSummaryItem } from "../api/insights";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "16px 20px",
        minWidth: "160px",
      }}
    >
      <div style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [sets, setSets] = useState<SetSummaryItem[]>([]);

  useEffect(() => {
    fetchSummary().then(setSummary).catch(console.error);
    fetchSetSummary().then((res) => setSets(res.items)).catch(console.error);
  }, []);

  if (!summary) return <div style={{ padding: "1.5rem", color: "#6b7280" }}>Lade Dashboard…</div>;

  const lastCrawl = summary.last_crawl_at
    ? new Date(summary.last_crawl_at).toLocaleString("de-DE")
    : "–";

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ marginBottom: "16px" }}>Dashboard</h1>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "32px" }}>
        <StatCard label="Produkte gesamt" value={summary.total_products} />
        <StatCard label="Crawls gesamt" value={summary.total_crawls} />
        <StatCard label="Letzter Crawl" value={lastCrawl} />
        <StatCard label="Produkte (letzter Crawl)" value={summary.products_in_last_crawl} />
        <StatCard label="Angebote (letzter Crawl)" value={summary.offers_in_last_crawl} />
        <StatCard label="Mit Realist. Preis" value={summary.product_stats_with_realistic_price} />
      </div>

      {/* Set Summary */}
      {sets.length > 0 && (
        <div>
          <h2 style={{ marginBottom: "8px" }}>Übersicht nach Set</h2>
          <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "12px" }}>
            Aggregierte Preisdaten nach Set (nur letzter Crawl pro Produkt).
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["Set", "Produkte", "Ø Preis €", "Min €", "Max €", "Gesamt verfügbar"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Set" ? "left" : "right",
                      padding: "8px 12px",
                      borderBottom: "2px solid #e5e7eb",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sets.map((s, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "7px 12px" }}>{s.set_name ?? "(ohne Set)"}</td>
                  <td style={{ textAlign: "right", padding: "7px 12px" }}>{s.product_count}</td>
                  <td style={{ textAlign: "right", padding: "7px 12px", fontWeight: 600 }}>
                    {s.avg_realistic_price?.toFixed(2) ?? "–"}
                  </td>
                  <td style={{ textAlign: "right", padding: "7px 12px" }}>
                    {s.min_price?.toFixed(2) ?? "–"}
                  </td>
                  <td style={{ textAlign: "right", padding: "7px 12px" }}>
                    {s.max_price?.toFixed(2) ?? "–"}
                  </td>
                  <td style={{ textAlign: "right", padding: "7px 12px", color: "#6b7280" }}>
                    {s.total_available_items?.toLocaleString("de-DE") ?? "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { fetchSummary, fetchSetSummary, type SummaryStats, type SetSummaryItem } from "../api/insights";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 min-w-40">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
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

  if (!summary) return <div className="p-6 text-gray-500">Lade Dashboard…</div>;

  const lastCrawl = summary.last_crawl_at
    ? new Date(summary.last_crawl_at).toLocaleString("de-DE")
    : "–";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>

      {/* Summary cards */}
      <div className="flex flex-wrap gap-3 mb-8">
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
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Übersicht nach Set</h2>
          <p className="text-sm text-gray-500 mb-3">
            Aggregierte Preisdaten nach Set (nur letzter Crawl pro Produkt).
          </p>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  {["Set", "Produkte", "Ø Preis €", "Min €", "Max €", "Gesamt verfügbar"].map((h) => (
                    <th
                      key={h}
                      className={`px-3 py-2 border-b-2 border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500 ${h === "Set" ? "text-left" : "text-right"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sets.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">{s.set_name ?? "(ohne Set)"}</td>
                    <td className="px-3 py-2 text-right">{s.product_count}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {s.avg_realistic_price?.toFixed(2) ?? "–"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {s.min_price?.toFixed(2) ?? "–"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {s.max_price?.toFixed(2) ?? "–"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {s.total_available_items?.toLocaleString("de-DE") ?? "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

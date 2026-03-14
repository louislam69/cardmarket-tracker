import { useEffect, useState } from "react";
import { fetchSummary, fetchSetSummary, type SummaryStats, type SetSummaryItem } from "../api/insights";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1 border-t-4 border-t-blue-500">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Übersicht über alle gecrawlten Pokémon-Produkte</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
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
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Übersicht nach Set</h2>
            <p className="text-sm text-gray-500">
              Aggregierte Preisdaten nach Set (nur letzter Crawl pro Produkt).
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  {["Set", "Produkte", "Ø Preis €", "Min €", "Max €", "Gesamt verfügbar"].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500 ${h === "Set" ? "text-left" : "text-right"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sets.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{s.set_name ?? "(ohne Set)"}</td>
                    <td className="px-4 py-3 text-right">{s.product_count}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {s.avg_realistic_price?.toFixed(2) ?? "–"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {s.min_price?.toFixed(2) ?? "–"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {s.max_price?.toFixed(2) ?? "–"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {s.total_available_items?.toLocaleString("de-DE") ?? "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

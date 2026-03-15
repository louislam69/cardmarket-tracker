import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { fetchSummary, fetchSetSummary, type SummaryStats, type SetSummaryItem } from "../api/insights";

// --- Icons (inline SVG, keine externe Library) ---
const IconBox = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);
const IconRefresh = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconChart = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);
const IconTag = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

// --- StatCard mit Farbe + Icon ---
const ACCENT_CLASSES: Record<string, { border: string; bg: string; text: string }> = {
  blue:   { border: "border-t-blue-500",   bg: "bg-blue-50",   text: "text-blue-600"   },
  indigo: { border: "border-t-indigo-500", bg: "bg-indigo-50", text: "text-indigo-600" },
  gray:   { border: "border-t-gray-400",   bg: "bg-gray-100",  text: "text-gray-500"   },
  teal:   { border: "border-t-teal-500",   bg: "bg-teal-50",   text: "text-teal-600"   },
  orange: { border: "border-t-orange-500", bg: "bg-orange-50", text: "text-orange-600" },
  green:  { border: "border-t-green-500",  bg: "bg-green-50",  text: "text-green-600"  },
};

function StatCard({ label, value, accent, icon }: {
  label: string;
  value: string | number;
  accent: string;
  icon: React.ReactNode;
}) {
  const c = ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.blue;
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-2 border-t-4 ${c.border}`}>
      <div className="flex justify-between items-start">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{label}</div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg} ${c.text}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [sets, setSets] = useState<SetSummaryItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSummary().then(setSummary).catch(console.error);
    fetchSetSummary().then((res) => setSets(res.items)).catch(console.error);
  }, []);

  if (!summary) return <div className="p-6 text-gray-500">Lade Dashboard…</div>;

  const lastCrawl = summary.last_crawl_at
    ? new Date(summary.last_crawl_at).toLocaleString("de-DE")
    : "–";

  const chartData = [...sets]
    .filter((s) => s.avg_realistic_price != null)
    .sort((a, b) => (b.avg_realistic_price ?? 0) - (a.avg_realistic_price ?? 0));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Übersicht über alle gecrawlten Pokémon-Produkte</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
        <StatCard label="Produkte gesamt"         value={summary.total_products}                        accent="blue"   icon={<IconBox />} />
        <StatCard label="Crawls gesamt"           value={summary.total_crawls}                          accent="indigo" icon={<IconRefresh />} />
        <StatCard label="Letzter Crawl"           value={lastCrawl}                                     accent="gray"   icon={<IconClock />} />
        <StatCard label="Produkte (letzter Crawl)" value={summary.products_in_last_crawl}               accent="teal"   icon={<IconChart />} />
        <StatCard label="Angebote (letzter Crawl)" value={summary.offers_in_last_crawl}                 accent="orange" icon={<IconTag />} />
        <StatCard label="Mit Realist. Preis"      value={summary.product_stats_with_realistic_price}    accent="green"  icon={<IconCheck />} />
      </div>

      {/* Set Summary */}
      {sets.length > 0 && (
        <div>
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Übersicht nach Set</h2>
            <p className="text-sm text-gray-500">
              Aggregierte Preisdaten nach Set (nur letzter Crawl). Zeile anklicken um Set zu filtern.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
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
                    <tr
                      key={i}
                      className="border-b border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/products?search=${encodeURIComponent(s.set_name ?? "")}`)}
                    >
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        <span className="text-blue-700 underline underline-offset-2">{s.set_name ?? "(ohne Set)"}</span>
                      </td>
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

          {/* Horizontal BarChart: Ø Preis nach Set */}
          {chartData.length > 0 && (
            <div>
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Ø Preis nach Set</h2>
                <p className="text-sm text-gray-500">Durchschnittlicher realistischer Preis je Set, absteigend sortiert.</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <ResponsiveContainer width="100%" height={chartData.length * 32 + 40}>
                  <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 4, right: 70, left: 8, bottom: 4 }}
                  >
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => v.toFixed(0) + " €"}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="set_name"
                      width={190}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v) => (typeof v === "number" ? v.toFixed(2) + " €" : v)}
                      labelFormatter={(label) => label ?? "(ohne Set)"}
                    />
                    <Bar dataKey="avg_realistic_price" name="Ø Preis" radius={[0, 4, 4, 0]}>
                      {chartData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={i === 0 ? "#2563eb" : i < 3 ? "#60a5fa" : "#93c5fd"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

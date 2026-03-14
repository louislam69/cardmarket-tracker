import { useEffect, useState } from "react";
import { fetchVolatility, type VolatilityItem } from "../api/insights";

function CvBadge({ cv }: { cv: number }) {
  if (cv >= 20) {
    return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-semibold">Hoch volatil</span>;
  } else if (cv >= 10) {
    return <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-semibold">Mittel</span>;
  } else {
    return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">Stabil</span>;
  }
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

  const inputClass = "border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const btnClass = "px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Volatilität</h1>
      <p className="text-sm text-gray-500 mb-4">
        Produkte mit den größten Preisschwankungen – sortiert nach Variationskoeffizient (CV).
        Nur Produkte mit ≥ 3 Crawls. Hohe CV = potenzielle Handelschance.
      </p>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          placeholder="Suche nach Produkt…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          className={`${inputClass} min-w-56`}
        />
        <select
          value={limit}
          onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
          className={inputClass}
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} pro Seite</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{total} Produkte</span>
      </div>

      {loading ? (
        <div className="text-gray-500">Lade…</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                {["Produkt", "Ø Preis €", "StdAbw €", "CV %", "Min €", "Max €", "Spanne €", "Crawls", "Einschätzung"].map((h) => (
                  <th key={h} className={`px-3 py-2 border-b-2 border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500 ${h === "Produkt" ? "text-left" : "text-right"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.product_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">{item.product_name}</td>
                  <td className="px-3 py-2 text-right">{item.avg_realistic_price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{item.stddev_price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-bold">{item.cv.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">{item.min_price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{item.max_price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{item.price_range.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{item.crawl_count}</td>
                  <td className="px-3 py-2 text-right">
                    <CvBadge cv={item.cv} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2 mt-3 items-center">
        <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className={btnClass}>
          ← Zurück
        </button>
        <span className="text-sm text-gray-500">
          {offset + 1}–{Math.min(offset + limit, total)} von {total}
        </span>
        <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} className={btnClass}>
          Weiter →
        </button>
      </div>
    </div>
  );
}

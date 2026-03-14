import { useEffect, useState } from "react";
import { fetchVolatility, type VolatilityItem } from "../api/insights";
import ProductDetailModal from "../components/ui/ProductDetailModal";

function CvBadge({ cv }: { cv: number }) {
  if (cv >= 20) return <span className="inline-block px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-xs font-semibold">Hoch volatil</span>;
  if (cv >= 10) return <span className="inline-block px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-800 text-xs font-semibold">Mittel</span>;
  return <span className="inline-block px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-xs font-semibold">Stabil</span>;
}

export default function VolatilityPage() {
  const [items, setItems] = useState<VolatilityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchVolatility(limit, offset, search || undefined)
      .then((res) => { setItems(res.items); setTotal(res.total); })
      .catch(() => setError("Fehler beim Laden der Daten"))
      .finally(() => setLoading(false));
  }, [limit, offset, search]);

  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const btnCls = "px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Volatilität</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Produkte nach Variationskoeffizient (CV) sortiert — nur Produkte mit ≥ 3 Crawls. Hohe CV = potenzielle Handelschance.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text" placeholder="Suche nach Produkt…" value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          className={`${inputCls} min-w-56`}
        />
        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }} className={inputCls}>
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n} pro Seite</option>)}
        </select>
        <span className="text-sm text-gray-400 ml-auto">{total} Produkte</span>
      </div>

      {error && <p className="text-red-700 mb-3 text-sm">{error}</p>}
      {loading && <p className="text-gray-500 text-sm py-4">Lade…</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-gray-500 text-sm">Keine Daten. Nur Produkte mit ≥ 3 Crawls werden angezeigt.</p>
      )}

      {!loading && items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                {["Produkt", "Ø Preis €", "StdAbw €", "CV %", "Min €", "Max €", "Spanne €", "Crawls", "Einschätzung"].map((h) => (
                  <th key={h} className={`px-4 py-3 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500 ${h === "Produkt" ? "text-left" : "text-right"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr
                  key={item.product_id}
                  onClick={() => setSelectedProduct({ id: item.product_id, name: item.product_name })}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{item.product_name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.avg_realistic_price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{item.stddev_price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{item.cv.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{item.min_price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{item.max_price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{item.price_range.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{item.crawl_count}</td>
                  <td className="px-4 py-3 text-right"><CvBadge cv={item.cv} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-2 mt-4 items-center">
        <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className={btnCls}>← Zurück</button>
        <span className="text-sm text-gray-500">{offset + 1}–{Math.min(offset + limit, total)} von {total}</span>
        <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} className={btnCls}>Weiter →</button>
      </div>

      <ProductDetailModal
        productId={selectedProduct?.id ?? null}
        productName={selectedProduct?.name ?? ""}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}

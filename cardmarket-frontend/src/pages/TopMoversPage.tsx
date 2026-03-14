import { useEffect, useState } from "react";
import { fetchTopMovers, type TopMoverItem } from "../api/insights";
import ProductDetailModal from "../components/ui/ProductDetailModal";

type Direction = "up" | "down" | "both";

export default function TopMoversPage() {
  const [items, setItems] = useState<TopMoverItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<Direction>("both");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchTopMovers(limit, offset, direction, 0, search || undefined)
      .then((res) => { setItems(res.items); setTotal(res.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [limit, offset, direction, search]);

  const fmt = (v: number) => v.toFixed(2) + " €";

  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const btnCls = "px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Top Movers</h1>
        <p className="text-sm text-gray-500 mt-0.5">Größte Preisänderungen zwischen letztem und vorletztem Crawl.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text" placeholder="Suche nach Produkt…" value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          className={`${inputCls} min-w-56`}
        />
        <select value={direction} onChange={(e) => { setDirection(e.target.value as Direction); setOffset(0); }} className={inputCls}>
          <option value="both">Alle Richtungen</option>
          <option value="up">Nur Gewinner ▲</option>
          <option value="down">Nur Verlierer ▼</option>
        </select>
        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }} className={inputCls}>
          {[25, 50, 100].map((n) => <option key={n} value={n}>{n} pro Seite</option>)}
        </select>
        <span className="text-sm text-gray-400 ml-auto">{total} Einträge</span>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm py-4">Lade…</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                {["Produkt", "Letzter Preis", "Vorheriger Preis", "Änderung €", "Änderung %", "Letzter Crawl"].map((h) => (
                  <th key={h} className={`px-4 py-3 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500 ${h === "Produkt" ? "text-left" : "text-right"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const positive = item.rel_change_pct >= 0;
                return (
                  <tr
                    key={item.product_id}
                    onClick={() => setSelectedProduct({ id: item.product_id, name: item.product_name })}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{item.product_name}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(item.last_price)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmt(item.prev_price)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${positive ? "text-green-700" : "text-red-700"}`}>
                      {(item.abs_change >= 0 ? "+" : "") + item.abs_change.toFixed(2)} €
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${positive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {(item.rel_change_pct >= 0 ? "+" : "") + item.rel_change_pct.toFixed(1)} %
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {new Date(item.last_crawled_at).toLocaleDateString("de-DE")}
                    </td>
                  </tr>
                );
              })}
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

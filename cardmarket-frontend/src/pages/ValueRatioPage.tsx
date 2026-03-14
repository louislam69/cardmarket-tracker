import { useEffect, useState } from "react";
import { fetchValueRatios, type ValueRatioItem } from "../api/insights";
import ProductDetailModal from "../components/ui/ProductDetailModal";

type SortOrder = "asc" | "desc";
const PAGE_SIZE_OPTIONS = [10, 25, 50];

function fmt(v: number) { return v.toFixed(2) + " €"; }
function fmtRatio(v: number) { return v.toFixed(2) + "×"; }

function SortableHeader({
  label, column, sortBy, sortOrder, onSort, align = "left",
}: {
  label: string; column: string; sortBy: string; sortOrder: SortOrder;
  onSort: (col: string) => void; align?: "left" | "right";
}) {
  const active = sortBy === column;
  const indicator = active ? (sortOrder === "asc" ? " ▲" : " ▼") : " ↕";
  return (
    <th
      onClick={() => onSort(column)}
      className={`px-4 py-3 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${active ? "text-blue-700" : "text-gray-500"}`}
    >
      {label}
      <span className={`text-xs ${active ? "text-blue-600" : "text-gray-300"}`}>{indicator}</span>
    </th>
  );
}

export default function ValueRatioPage() {
  const [items, setItems] = useState<ValueRatioItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("value_ratio");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedProduct, setSelectedProduct] = useState<{ id: number; name: string } | null>(null);

  function handleSort(column: string) {
    if (column === sortBy) setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    else { setSortBy(column); setSortOrder("desc"); }
    setOffset(0);
  }

  useEffect(() => {
    setLoading(true); setError(null);
    fetchValueRatios(limit, offset, search || undefined, sortBy, sortOrder)
      .then((res) => { setItems(res.items); setTotal(res.total); })
      .catch(() => setError("Fehler beim Laden der Daten"))
      .finally(() => setLoading(false));
  }, [limit, offset, search, sortBy, sortOrder]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const inputCls = "border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const btnCls = "px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Sealed vs. Singles</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Value Ratio = Singles-Wert / Sealed-Preis. Ratio &gt; 1 bedeutet: Sealed kaufen lohnt sich.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text" placeholder="Produktname suchen…" value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          className={`${inputCls} min-w-52`}
        />
        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }} className={inputCls}>
          {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s} pro Seite</option>)}
        </select>
        <span className="text-sm text-gray-400 ml-auto">{total} Produkte</span>
      </div>

      {error && <p className="text-red-700 mb-3 text-sm">{error}</p>}
      {loading && <p className="text-gray-500 text-sm py-4">Lade…</p>}

      {!loading && items.length === 0 && !error && (
        <p className="text-gray-500 text-sm">
          Keine Daten. Stelle sicher, dass sealed_contents mit linked_product_id befüllt ist.
        </p>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader label="Produkt" column="product_name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                  <SortableHeader label="Sealed-Preis" column="sealed_price" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableHeader label="Singles-Wert" column="singles_sum" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableHeader label="Ratio" column="value_ratio" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                  <th className="px-4 py-3 border-b border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Komp.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const ratioGood = item.value_ratio >= 1;
                  return (
                    <tr
                      key={item.product_id}
                      onClick={() => setSelectedProduct({ id: item.product_id, name: item.product_name })}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{item.product_name}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(item.sealed_price)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(item.singles_sum)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-sm font-bold ${ratioGood ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {fmtRatio(item.value_ratio)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">{item.priced_components}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 items-center mt-4">
            <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className={btnCls}>Zurück</button>
            <span className="text-sm text-gray-500">Seite {currentPage} / {totalPages || 1}</span>
            <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} className={btnCls}>Weiter</button>
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

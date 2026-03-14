import { useEffect, useState } from "react";
import {
  fetchLatestPrices,
  type LatestPricesResponse,
  type LatestPriceItem,
} from "../api/insights";
import ProductDetailModal from "../components/ui/ProductDetailModal";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

type SortOrder = "asc" | "desc";

function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return "–";
  return value.toFixed(2) + " €";
}

function formatDate(value: string): string {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("de-DE");
}

function formatReleaseDate(value: string | null): string {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("de-DE");
}

function SortableHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
  align = "left",
}: {
  label: string;
  column: string;
  sortBy: string;
  sortOrder: SortOrder;
  onSort: (col: string) => void;
  align?: "left" | "right";
}) {
  const active = sortBy === column;
  const indicator = active ? (sortOrder === "asc" ? " ▲" : " ▼") : " ↕";
  return (
    <th
      onClick={() => onSort(column)}
      className={`px-3 py-2 border-b-2 border-gray-200 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap ${align === "right" ? "text-right" : "text-left"} ${active ? "text-blue-700" : "text-gray-500"}`}
    >
      {label}
      <span className={`text-xs ${active ? "text-blue-700" : "text-gray-400"}`}>{indicator}</span>
    </th>
  );
}

export default function ProductsPage() {
  const [data, setData] = useState<LatestPricesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("product_name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const [selectedProduct, setSelectedProduct] = useState<{ id: number; name: string } | null>(null);

  function handleSort(column: string) {
    if (column === sortBy) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setOffset(0);
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchLatestPrices(
      limit,
      offset,
      search || undefined,
      minPrice !== "" ? Number(minPrice) : undefined,
      maxPrice !== "" ? Number(maxPrice) : undefined,
      sortBy,
      sortOrder,
    )
      .then(setData)
      .catch((err) => {
        console.error(err);
        setError("Fehler beim Laden der Produkte");
      })
      .finally(() => setLoading(false));
  }, [limit, offset, search, minPrice, maxPrice, sortBy, sortOrder]);

  const inputClass = "border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const btnClass = "px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Produkte</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <input
          type="text"
          placeholder="Suche nach Produkt…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          className={`${inputClass} min-w-56`}
        />
        <input
          type="number"
          placeholder="Min €"
          value={minPrice}
          onChange={(e) => { setMinPrice(e.target.value); setOffset(0); }}
          className={`${inputClass} w-24`}
        />
        <input
          type="number"
          placeholder="Max €"
          value={maxPrice}
          onChange={(e) => { setMaxPrice(e.target.value); setOffset(0); }}
          className={`${inputClass} w-24`}
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          Einträge:
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
            className={inputClass}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <span className="text-sm text-gray-500">
          {offset + 1}–{Math.min(offset + limit, data?.total ?? 0)} von {data?.total ?? 0}
        </span>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}
      {loading && <div className="text-gray-500">Lade Produkte…</div>}

      {!loading && data && data.items.length === 0 && (
        <div className="text-gray-500">Keine Produkte gefunden.</div>
      )}

      {!loading && data && data.items.length > 0 && (
        <>
          <p className="text-xs text-gray-400 mb-2">
            Zeile anklicken für Preishistorie, Angebots-Verteilung und Kaufsignal. Spaltenköpfe anklicken zum Sortieren.
          </p>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader label="Produkt" column="product_name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="left" />
                  <SortableHeader label="Ab €" column="from_price" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableHeader label="Realist. €" column="realistic_price" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableHeader label="Trend €" column="price_trend" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableHeader label="Ø 30d" column="avg_30d" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableHeader label="Ø 7d" column="avg_7d" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableHeader label="Ø 1d" column="avg_1d" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableHeader label="Letzter Crawl" column="last_crawled_at" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                  <SortableHeader label="Erscheinungsdatum" column="release_date" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                  <th className="px-3 py-2 border-b-2 border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500 text-right">Angebote</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item: LatestPriceItem) => (
                  <tr
                    key={item.product_id}
                    onClick={() => setSelectedProduct({ id: item.product_id, name: item.product_name })}
                    className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer"
                  >
                    <td className="px-3 py-2">{item.product_name}</td>
                    <td className="px-3 py-2 text-right">{formatPrice(item.from_price)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatPrice(item.realistic_price)}</td>
                    <td className="px-3 py-2 text-right">{formatPrice(item.price_trend)}</td>
                    <td className="px-3 py-2 text-right">{formatPrice(item.avg_30d)}</td>
                    <td className="px-3 py-2 text-right">{formatPrice(item.avg_7d)}</td>
                    <td className="px-3 py-2 text-right">{formatPrice(item.avg_1d)}</td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">
                      {formatDate(item.last_crawled_at)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500 text-xs">
                      {formatReleaseDate(item.release_date)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {item.offers_used ?? "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex gap-2 items-center">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className={btnClass}
            >
              ← Zurück
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={!data || offset + limit >= data.total}
              className={btnClass}
            >
              Weiter →
            </button>
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

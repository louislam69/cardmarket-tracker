import { useEffect, useState } from "react";
import { fetchValueRatios, type ValueRatioItem } from "../api/insights";
import ProductDetailModal from "../components/ui/ProductDetailModal";

type SortOrder = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function fmt(v: number) {
  return v.toFixed(2) + " €";
}

function fmtRatio(v: number) {
  return v.toFixed(2) + "×";
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
      style={{
        borderBottom: "2px solid #e5e7eb",
        textAlign: align,
        padding: "8px 10px",
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        color: active ? "#1d4ed8" : undefined,
      }}
    >
      {label}
      <span style={{ color: active ? "#1d4ed8" : "#9ca3af", fontSize: "0.75rem" }}>{indicator}</span>
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
    if (column === sortBy) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setOffset(0);
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchValueRatios(limit, offset, search || undefined, sortBy, sortOrder)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => setError("Fehler beim Laden der Daten"))
      .finally(() => setLoading(false));
  }, [limit, offset, search, sortBy, sortOrder]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div style={{ padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>
        Sealed vs. Singles
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        Value Ratio = Singles-Wert / Sealed-Preis. Ratio &gt; 1 bedeutet: Sealed kaufen lohnt sich.
        Nur Produkte mit verlinkten Komponenten und bekannten Preisen werden angezeigt.
      </p>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Produktname suchen…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.875rem", minWidth: "200px" }}
        />
        <select
          value={limit}
          onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
          style={{ padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.875rem" }}
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s} pro Seite</option>
          ))}
        </select>
        <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
          {total} Produkte
        </span>
      </div>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {loading && <p style={{ color: "#6b7280" }}>Lade…</p>}

      {!loading && items.length === 0 && !error && (
        <p style={{ color: "#6b7280" }}>
          Keine Daten. Stelle sicher, dass sealed_contents mit linked_product_id befüllt ist und Preise für die verlinkten Produkte vorliegen.
        </p>
      )}

      {!loading && items.length > 0 && (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <SortableHeader label="Produkt" column="product_name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="left" />
                <SortableHeader label="Sealed-Preis" column="sealed_price" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                <SortableHeader label="Singles-Wert" column="singles_sum" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                <SortableHeader label="Ratio" column="value_ratio" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} align="right" />
                <th style={{ borderBottom: "2px solid #e5e7eb", textAlign: "right", padding: "8px 10px" }}>Komp.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const ratioGood = item.value_ratio >= 1;
                return (
                  <tr
                    key={item.product_id}
                    onClick={() => setSelectedProduct({ id: item.product_id, name: item.product_name })}
                    style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f9ff")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <td style={{ padding: "7px 10px", fontWeight: 500 }}>{item.product_name}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: "#374151" }}>
                      {fmt(item.sealed_price)}
                    </td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: "#374151" }}>
                      {fmt(item.singles_sum)}
                    </td>
                    <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: ratioGood ? "#15803d" : "#b91c1c" }}>
                      {fmtRatio(item.value_ratio)}
                    </td>
                    <td style={{ padding: "7px 10px", textAlign: "right", color: "#6b7280", fontSize: "0.8rem" }}>
                      {item.priced_components}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "1rem" }}>
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              style={{ padding: "5px 12px", borderRadius: "4px", border: "1px solid #d1d5db", cursor: offset === 0 ? "not-allowed" : "pointer", opacity: offset === 0 ? 0.5 : 1 }}
            >
              Zurück
            </button>
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
              Seite {currentPage} / {totalPages || 1}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              style={{ padding: "5px 12px", borderRadius: "4px", border: "1px solid #d1d5db", cursor: offset + limit >= total ? "not-allowed" : "pointer", opacity: offset + limit >= total ? 0.5 : 1 }}
            >
              Weiter
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

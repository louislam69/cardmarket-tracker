import { useEffect, useState } from "react";
import { fetchMonthlyMoM, type MonthlyMoMItem } from "../api/insights";

type Direction = "up" | "down" | "both";

export default function MonthlyPage() {
  const [items, setItems] = useState<MonthlyMoMItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<Direction>("both");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchMonthlyMoM(limit, offset, direction, undefined, search || undefined)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [limit, offset, direction, search]);

  const inputClass = "border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const btnClass = "px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Monatsvergleich (MoM)</h1>
      <p className="text-sm text-gray-500 mb-4">
        Monat-über-Monat Vergleich der durchschnittlichen Preise pro Produkt.
      </p>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <input
          type="text"
          placeholder="Suche nach Produkt…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          className={`${inputClass} min-w-56`}
        />
        <select
          value={direction}
          onChange={(e) => { setDirection(e.target.value as Direction); setOffset(0); }}
          className={inputClass}
        >
          <option value="both">Alle Richtungen</option>
          <option value="up">Nur Gewinner ▲</option>
          <option value="down">Nur Verlierer ▼</option>
        </select>
        <select
          value={limit}
          onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
          className={inputClass}
        >
          {[25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} pro Seite</option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{total} Einträge</span>
      </div>

      {loading ? (
        <div className="text-gray-500">Lade…</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                {["Produkt", "Monat", "Vormonat", "Ø aktuell €", "Ø vorher €", "Änderung €", "Änderung %", "Messpunkte"].map((h) => (
                  <th key={h} className={`px-3 py-2 border-b-2 border-gray-200 text-xs font-semibold uppercase tracking-wide text-gray-500 ${h === "Produkt" ? "text-left" : "text-right"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const positive = item.rel_change_pct >= 0;
                return (
                  <tr key={`${item.product_id}-${item.month}-${i}`} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">{item.product_name}</td>
                    <td className="px-3 py-2 text-right">{item.month}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{item.prev_month}</td>
                    <td className="px-3 py-2 text-right">{item.avg_realistic_price.toFixed(2)} €</td>
                    <td className="px-3 py-2 text-right">{item.prev_avg_price.toFixed(2)} €</td>
                    <td className={`px-3 py-2 text-right ${positive ? "text-green-700" : "text-red-700"}`}>
                      {(item.abs_change >= 0 ? "+" : "") + item.abs_change.toFixed(2)} €
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${positive ? "text-green-700" : "text-red-700"}`}>
                      {(item.rel_change_pct >= 0 ? "+" : "") + item.rel_change_pct.toFixed(1)} %
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{item.num_points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
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

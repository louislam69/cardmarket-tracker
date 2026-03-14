import type { OfferDistribution } from "../../api/insights";

interface Props {
  data: OfferDistribution;
}

export default function OfferDistributionPanel({ data }: Props) {
  const range = data.max_price - data.min_price;
  const pct = (v: number) => (range === 0 ? 50 : ((v - data.min_price) / range) * 100);

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">
        Preisverteilung — {data.offer_count} Angebote von {data.seller_count} Verkäufern
        <span className="font-normal text-gray-500 text-xs ml-2">
          (Gesamt: {data.total_qty} Stück)
        </span>
      </h4>

      {/* Price range bar */}
      <div className="relative h-6 bg-gray-200 rounded mt-3 mb-1">
        {/* IQR box */}
        <div
          className="absolute h-full bg-blue-200 rounded-sm"
          style={{
            left: `${pct(data.p25_price)}%`,
            width: `${Math.max(pct(data.p75_price) - pct(data.p25_price), 2)}%`,
          }}
        />
        {/* Median marker */}
        <div
          className="absolute w-0.5 h-full bg-blue-600"
          style={{
            left: `${pct(data.median_price)}%`,
            transform: "translateX(-50%)",
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mb-4">
        <span>Min: {data.min_price.toFixed(2)} €</span>
        <span>P25: {data.p25_price.toFixed(2)} €</span>
        <span>Median: {data.median_price.toFixed(2)} €</span>
        <span>P75: {data.p75_price.toFixed(2)} €</span>
        <span>Max: {data.max_price.toFixed(2)} €</span>
      </div>

      {/* Condition breakdown */}
      <h4 className="text-sm font-semibold text-gray-700 mb-2">Zustand-Aufschlüsselung</h4>
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50">
          <tr>
            {["Zustand", "Anzahl", "Min €", "Ø €", "Max €"].map((h) => (
              <th
                key={h}
                className={`px-2.5 py-1.5 border-b border-gray-200 text-xs font-semibold text-gray-600 ${h === "Zustand" ? "text-left" : "text-right"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.conditions.map((c) => (
            <tr key={c.condition} className="border-b border-gray-100">
              <td className="px-2.5 py-1.5">{c.condition}</td>
              <td className="px-2.5 py-1.5 text-right">{c.count}</td>
              <td className="px-2.5 py-1.5 text-right">{c.min_price?.toFixed(2) ?? "—"}</td>
              <td className="px-2.5 py-1.5 text-right">{c.avg_price?.toFixed(2) ?? "—"}</td>
              <td className="px-2.5 py-1.5 text-right">{c.max_price?.toFixed(2) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

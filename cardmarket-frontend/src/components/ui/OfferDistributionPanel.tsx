import type { OfferDistribution } from "../../api/insights";

interface Props {
  data: OfferDistribution;
}

export default function OfferDistributionPanel({ data }: Props) {
  const range = data.max_price - data.min_price;
  const pct = (v: number) => (range === 0 ? 50 : ((v - data.min_price) / range) * 100);

  return (
    <div>
      <h4 style={{ margin: "0 0 8px" }}>
        Preisverteilung — {data.offer_count} Angebote von {data.seller_count} Verkäufern
        <span style={{ fontWeight: 400, color: "#6b7280", fontSize: "0.85rem", marginLeft: "8px" }}>
          (Gesamt: {data.total_qty} Stück)
        </span>
      </h4>

      {/* Price range bar */}
      <div
        style={{
          position: "relative",
          height: "24px",
          background: "#e5e7eb",
          borderRadius: "4px",
          margin: "12px 0 4px",
        }}
      >
        {/* IQR box */}
        <div
          style={{
            position: "absolute",
            left: `${pct(data.p25_price)}%`,
            width: `${Math.max(pct(data.p75_price) - pct(data.p25_price), 2)}%`,
            height: "100%",
            background: "#bfdbfe",
            borderRadius: "2px",
          }}
        />
        {/* Median marker */}
        <div
          style={{
            position: "absolute",
            left: `${pct(data.median_price)}%`,
            transform: "translateX(-50%)",
            width: "3px",
            height: "100%",
            background: "#2563eb",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.78rem",
          color: "#6b7280",
          marginBottom: "16px",
        }}
      >
        <span>Min: {data.min_price.toFixed(2)} €</span>
        <span>P25: {data.p25_price.toFixed(2)} €</span>
        <span>Median: {data.median_price.toFixed(2)} €</span>
        <span>P75: {data.p75_price.toFixed(2)} €</span>
        <span>Max: {data.max_price.toFixed(2)} €</span>
      </div>

      {/* Condition breakdown */}
      <h4 style={{ margin: "0 0 8px" }}>Zustand-Aufschlüsselung</h4>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {["Zustand", "Anzahl", "Min €", "Ø €", "Max €"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: h === "Zustand" ? "left" : "right",
                  padding: "6px 10px",
                  borderBottom: "1px solid #e5e7eb",
                  fontWeight: 600,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.conditions.map((c) => (
            <tr key={c.condition} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "5px 10px" }}>{c.condition}</td>
              <td style={{ textAlign: "right", padding: "5px 10px" }}>{c.count}</td>
              <td style={{ textAlign: "right", padding: "5px 10px" }}>
                {c.min_price?.toFixed(2) ?? "—"}
              </td>
              <td style={{ textAlign: "right", padding: "5px 10px" }}>
                {c.avg_price?.toFixed(2) ?? "—"}
              </td>
              <td style={{ textAlign: "right", padding: "5px 10px" }}>
                {c.max_price?.toFixed(2) ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

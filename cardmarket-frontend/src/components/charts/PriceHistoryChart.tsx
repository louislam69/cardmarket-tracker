import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { PriceHistoryPoint } from "../../api/insights";

interface Props {
  data: PriceHistoryPoint[];
}

export default function PriceHistoryChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.crawled_at).toLocaleDateString("de-DE"),
  }));

  const validPrices = data
    .filter((d) => d.realistic_price !== null)
    .map((d) => d.realistic_price as number);
  const avgPrice =
    validPrices.length > 0
      ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length
      : null;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis
          tickFormatter={(v: number) => v.toFixed(0) + " €"}
          tick={{ fontSize: 11 }}
          width={65}
        />
        <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(2) + " €" : v)} />
        <Legend />
        {avgPrice !== null && (
          <ReferenceLine
            y={avgPrice}
            stroke="#f59e0b"
            strokeDasharray="5 3"
            label={{
              value: `Ø ${avgPrice.toFixed(2)} €`,
              position: "insideTopRight",
              fontSize: 10,
              fill: "#f59e0b",
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="realistic_price"
          name="Realist. Preis"
          stroke="#2563eb"
          dot={false}
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="from_price"
          name="Ab-Preis"
          stroke="#16a34a"
          dot={false}
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

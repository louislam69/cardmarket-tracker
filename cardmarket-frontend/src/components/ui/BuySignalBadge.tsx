interface Props {
  percentile: number;
}

export default function BuySignalBadge({ percentile }: Props) {
  let label: string;
  let color: string;
  let bg: string;

  if (percentile <= 25) {
    label = "Günstig";
    color = "#15803d";
    bg = "#dcfce7";
  } else if (percentile <= 60) {
    label = "Mittelfeld";
    color = "#92400e";
    bg = "#fef3c7";
  } else {
    label = "Teuer";
    color = "#b91c1c";
    bg = "#fee2e2";
  }

  return (
    <span
      style={{
        backgroundColor: bg,
        color,
        padding: "3px 10px",
        borderRadius: "12px",
        fontWeight: 600,
        fontSize: "0.82rem",
        display: "inline-block",
      }}
    >
      {label} ({percentile.toFixed(0)}. Pz.)
    </span>
  );
}

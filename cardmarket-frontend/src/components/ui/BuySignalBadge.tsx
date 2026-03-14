interface Props {
  percentile: number;
}

export default function BuySignalBadge({ percentile }: Props) {
  let className: string;
  let label: string;

  if (percentile <= 25) {
    label = "Günstig";
    className = "bg-green-100 text-green-700";
  } else if (percentile <= 60) {
    label = "Mittelfeld";
    className = "bg-yellow-100 text-yellow-800";
  } else {
    label = "Teuer";
    className = "bg-red-100 text-red-700";
  }

  return (
    <span className={`${className} px-2.5 py-0.5 rounded-full text-xs font-semibold inline-block`}>
      {label} ({percentile.toFixed(0)}. Pz.)
    </span>
  );
}

import { useEffect, useState } from "react";
import Modal from "./Modal";
import PriceHistoryChart from "../charts/PriceHistoryChart";
import OfferDistributionPanel from "./OfferDistributionPanel";
import BuySignalBadge from "./BuySignalBadge";
import {
  fetchPriceHistory,
  fetchOfferDistribution,
  fetchPercentilePosition,
  type PriceHistoryPoint,
  type OfferDistribution,
  type PercentilePosition,
} from "../../api/insights";
import { fetchProduct } from "../../api/products";
import { fetchSealedContents, type SealedContentsResponse } from "../../api/sealed";

const COMPONENT_LABELS: Record<string, string> = {
  booster_pack:    "Booster Pack",
  etb_box:         "Elite Trainer Box",
  booster_box:     "Booster Display (36 Packs)",
  promo_card:      "Promo-Karte",
  promo_code:      "Code-Karte",
  coin:            "Collector Coin",
  damage_counter:  "Damage Counter",
  dice:            "Würfel",
  card_sleeves:    "Card Sleeves",
  deck_box:        "Deck Box",
  playmat:         "Playmat",
  sticker_sheet:   "Sticker-Bogen",
  poster:          "Poster",
  binder:          "Binder",
  rulebook:        "Regelwerk",
  pin_badge:       "Pin",
  figure:          "Figur",
};

function formatReleaseDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

interface Props {
  productId: number | null;
  productName: string;
  onClose: () => void;
}

export default function ProductDetailModal({ productId, productName, onClose }: Props) {
  const [history, setHistory] = useState<PriceHistoryPoint[] | null>(null);
  const [distribution, setDistribution] = useState<OfferDistribution | null>(null);
  const [percentile, setPercentile] = useState<PercentilePosition | null>(null);
  const [releaseDate, setReleaseDate] = useState<string | null>(null);
  const [sealedContents, setSealedContents] = useState<SealedContentsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (productId === null) return;
    setLoading(true);
    setHistory(null);
    setDistribution(null);
    setPercentile(null);
    setReleaseDate(null);
    setSealedContents(null);

    Promise.allSettled([
      fetchPriceHistory(productId),
      fetchOfferDistribution(productId),
      fetchPercentilePosition(productId),
      fetchProduct(productId),
      fetchSealedContents(productId),
    ]).then(([histRes, distRes, pctRes, productRes, sealedRes]) => {
      if (histRes.status === "fulfilled") setHistory(histRes.value);
      if (distRes.status === "fulfilled") setDistribution(distRes.value);
      if (pctRes.status === "fulfilled") setPercentile(pctRes.value);
      if (productRes.status === "fulfilled") setReleaseDate(productRes.value.release_date);
      if (sealedRes.status === "fulfilled") setSealedContents(sealedRes.value);
      setLoading(false);
    });
  }, [productId]);

  return (
    <Modal open={productId !== null} onClose={onClose} title={productName}>
      {loading && <div style={{ color: "#6b7280", padding: "24px 0" }}>Lade Daten…</div>}

      {!loading && (
        <>
          {percentile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "20px",
                padding: "10px 14px",
                background: "#f9fafb",
                borderRadius: "6px",
                flexWrap: "wrap",
              }}
            >
              <BuySignalBadge percentile={percentile.percentile_position} />
              <span style={{ fontSize: "0.85rem", color: "#374151" }}>
                Aktuell: <strong>{percentile.current_price.toFixed(2)} €</strong>
              </span>
              <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                Historisch: {percentile.historical_min.toFixed(2)} – {percentile.historical_max.toFixed(2)} €
                &nbsp;|&nbsp;Ø {percentile.historical_avg.toFixed(2)} €
                &nbsp;|&nbsp;{percentile.crawl_count} Crawls
              </span>
            </div>
          )}

          {releaseDate && (
            <div style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "16px" }}>
              Erscheinungsdatum: <strong style={{ color: "#374151" }}>{formatReleaseDate(releaseDate)}</strong>
            </div>
          )}

          {sealedContents && sealedContents.items.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ margin: "0 0 8px", fontSize: "0.9rem", color: "#374151" }}>Inhalt</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <tbody>
                  {sealedContents.items.map((item) => (
                    <tr key={item.component_type} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "4px 8px", color: "#6b7280" }}>
                        {COMPONENT_LABELS[item.component_type] ?? item.component_type}
                      </td>
                      <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 600 }}>
                        {item.qty}×
                      </td>
                      <td style={{ padding: "4px 8px", color: "#6b7280" }}>
                        {item.linked_product_name ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {history && history.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ margin: "0 0 8px" }}>Preisverlauf</h4>
              <PriceHistoryChart data={history} />
            </div>
          )}

          {distribution && (
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
              <OfferDistributionPanel data={distribution} />
            </div>
          )}

          {!history && !distribution && !percentile && (
            <div style={{ color: "#6b7280" }}>Keine Daten verfügbar.</div>
          )}
        </>
      )}
    </Modal>
  );
}

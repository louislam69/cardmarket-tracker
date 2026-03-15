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

function MiniStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`font-bold ${highlight ? "text-xl text-blue-700" : "text-base text-gray-800"}`}>
        {value.toFixed(2)} €
      </div>
    </div>
  );
}

function PercentileGauge({ value }: { value: number }) {
  const color = value <= 25 ? "bg-green-500" : value <= 60 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Günstigstes Niveau</span>
        <span className="font-medium">Historisches Perzentil: {value.toFixed(0)} %</span>
        <span>Teuerstes Niveau</span>
      </div>
      <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
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
  const [cardmarketUrl, setCardmarketUrl] = useState<string | null>(null);
  const [sealedContents, setSealedContents] = useState<SealedContentsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [nestedProduct, setNestedProduct] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    if (productId === null) return;
    setLoading(true);
    setHistory(null);
    setDistribution(null);
    setPercentile(null);
    setReleaseDate(null);
    setCardmarketUrl(null);
    setSealedContents(null);
    setNestedProduct(null);

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
      if (productRes.status === "fulfilled") {
        setReleaseDate(productRes.value.release_date);
        setCardmarketUrl(productRes.value.cardmarket_url ?? null);
      }
      if (sealedRes.status === "fulfilled") setSealedContents(sealedRes.value);
      setLoading(false);
    });
  }, [productId]);

  const titleNode = (
    <span className="flex items-center gap-2">
      {productName}
      {cardmarketUrl && (
        <a
          href={cardmarketUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Auf Cardmarket ansehen"
          className="flex items-center text-blue-600 hover:text-blue-800 flex-shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      )}
    </span>
  );

  return (
    <>
      <Modal open={productId !== null} onClose={onClose} title={titleNode}>
        {loading && <div className="text-gray-500 py-6">Lade Daten…</div>}

        {!loading && (
          <>
            {/* Preis-Zusammenfassungs-Card */}
            {percentile && (
              <>
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mb-3">
                  <div className="flex justify-between items-center mb-3">
                    <BuySignalBadge percentile={percentile.percentile_position} />
                    <span className="text-xs text-gray-400">
                      {percentile.crawl_count} Crawls
                      {releaseDate && ` · ${formatReleaseDate(releaseDate)}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MiniStat label="Aktuell" value={percentile.current_price} highlight />
                    <MiniStat label="Min (hist.)" value={percentile.historical_min} />
                    <MiniStat label="Ø (hist.)" value={percentile.historical_avg} />
                    <MiniStat label="Max (hist.)" value={percentile.historical_max} />
                  </div>
                </div>
                <PercentileGauge value={percentile.percentile_position} />
              </>
            )}

            {/* Sealed Contents */}
            {sealedContents && sealedContents.items.length > 0 && (
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Inhalt</h4>
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    {sealedContents.items.map((item) => (
                      <tr key={item.component_type} className="border-b border-gray-100 last:border-0">
                        <td className="px-2 py-1.5 text-gray-500">
                          {COMPONENT_LABELS[item.component_type] ?? item.component_type}
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold w-8">{item.qty}×</td>
                        <td className="px-2 py-1.5">
                          {item.linked_product_id && item.linked_product_name ? (
                            <button
                              onClick={() => setNestedProduct({ id: item.linked_product_id!, name: item.linked_product_name! })}
                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                            >
                              {item.linked_product_name}
                            </button>
                          ) : (
                            <span className="text-gray-500">{item.linked_product_name ?? ""}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Preisverlauf */}
            {history && history.length > 0 && (
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Preisverlauf</h4>
                <PriceHistoryChart data={history} />
              </div>
            )}

            {/* Preisverteilung */}
            {distribution && (
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mb-4">
                <OfferDistributionPanel data={distribution} />
              </div>
            )}

            {!history && !distribution && !percentile && (
              <div className="text-gray-500">Keine Daten verfügbar.</div>
            )}
          </>
        )}
      </Modal>

      {/* Verschachteltes Modal für verlinkte Produkte */}
      {nestedProduct && (
        <ProductDetailModal
          productId={nestedProduct.id}
          productName={nestedProduct.name}
          onClose={() => setNestedProduct(null)}
        />
      )}
    </>
  );
}

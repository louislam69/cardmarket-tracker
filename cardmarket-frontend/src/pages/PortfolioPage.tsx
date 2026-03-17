import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import Modal from "../components/ui/Modal";
import ProductDetailModal from "../components/ui/ProductDetailModal";
import {
  fetchPortfolioPurchases,
  fetchPortfolioSummary,
  fetchPortfolioHistory,
  addPurchase,
  updatePurchase,
  deletePurchase,
  type PurchaseItem,
  type PortfolioSummary,
  type PortfolioHistoryPoint,
} from "../api/portfolio";
import { fetchProducts, type Product } from "../api/products";

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const IconWallet = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
  </svg>
);
const IconTrend = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
  </svg>
);
const IconPL = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
const fmt = (v: number) => v.toFixed(2) + " €";
const fmtPct = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(1) + "%";

const ACCENT: Record<string, { border: string; bg: string; text: string }> = {
  blue:  { border: "border-t-blue-500",  bg: "bg-blue-50",  text: "text-blue-600"  },
  green: { border: "border-t-green-500", bg: "bg-green-50", text: "text-green-600" },
  red:   { border: "border-t-red-500",   bg: "bg-red-50",   text: "text-red-600"   },
};

function StatCard({ label, value, sub, accent, icon }: {
  label: string; value: string; sub?: string; accent: string; icon: React.ReactNode;
}) {
  const c = ACCENT[accent] ?? ACCENT.blue;
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-2 border-t-4 ${c.border}`}>
      <div className="flex justify-between items-start">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{label}</div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg} ${c.text}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
      {sub && <div className="text-sm text-gray-500">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formular-State
// ---------------------------------------------------------------------------
interface FormState {
  product_id: string;
  purchase_date: string;
  purchase_price: string;
  quantity: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  product_id: "",
  purchase_date: new Date().toISOString().slice(0, 10),
  purchase_price: "",
  quantity: "1",
  notes: "",
});

const inputCls =
  "border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full";

// ---------------------------------------------------------------------------
// Hauptkomponente
// ---------------------------------------------------------------------------
export default function PortfolioPage() {
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PurchaseItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Produktdetail-Modal
  const [detailProductId, setDetailProductId] = useState<number | null>(null);

  // Löschen-Bestätigung
  const [deleteTarget, setDeleteTarget] = useState<PurchaseItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------------------------------------------------------------------------
  // Daten laden
  // ---------------------------------------------------------------------------
  const reload = async () => {
    try {
      const [p, s, h] = await Promise.all([
        fetchPortfolioPurchases(),
        fetchPortfolioSummary(),
        fetchPortfolioHistory(),
      ]);
      setPurchases(p);
      setSummary(s);
      setHistory(h);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    Promise.all([reload(), fetchProducts().then(setProducts)])
      .finally(() => setLoading(false));
  }, []);

  // ---------------------------------------------------------------------------
  // Formular öffnen/schließen
  // ---------------------------------------------------------------------------
  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (item: PurchaseItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTarget(item);
    setForm({
      product_id: String(item.product_id),
      purchase_date: item.purchase_date,
      purchase_price: String(item.purchase_price),
      quantity: String(item.quantity),
      notes: item.notes ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditTarget(null);
  };

  // ---------------------------------------------------------------------------
  // Speichern
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    if (!form.product_id || !form.purchase_date || !form.purchase_price) {
      setFormError("Produkt, Datum und Kaufpreis sind Pflichtfelder.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        product_id: parseInt(form.product_id),
        purchase_date: form.purchase_date,
        purchase_price: parseFloat(form.purchase_price),
        quantity: parseInt(form.quantity) || 1,
        notes: form.notes || undefined,
      };
      if (editTarget) {
        await updatePurchase(editTarget.id, payload);
      } else {
        await addPurchase(payload);
      }
      closeForm();
      await reload();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Löschen
  // ---------------------------------------------------------------------------
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePurchase(deleteTarget.id);
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) return <div className="p-8 text-center text-gray-500">Lade Portfolio…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  const plAccent = !summary || summary.pl_abs >= 0 ? "green" : "red";
  const valueAccent = !summary || summary.pl_abs >= 0 ? "green" : "red";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Mein Portfolio</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <IconPlus /> Kauf hinzufügen
        </button>
      </div>

      {/* KPI-Karten */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Investiert"
            value={fmt(summary.total_invested)}
            sub={`${summary.purchase_count} Kauf${summary.purchase_count !== 1 ? "positionen" : "sposition"}`}
            accent="blue"
            icon={<IconWallet />}
          />
          <StatCard
            label="Aktueller Wert"
            value={fmt(summary.current_value)}
            accent={valueAccent}
            icon={<IconTrend />}
          />
          <StatCard
            label="Gewinn / Verlust"
            value={fmt(summary.pl_abs)}
            sub={summary.pl_pct != null ? fmtPct(summary.pl_pct) : undefined}
            accent={plAccent}
            icon={<IconPL />}
          />
        </div>
      )}

      {/* Wertentwicklungs-Chart */}
      {history.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Wertentwicklung</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={history} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickFormatter={(v: string) => {
                  const d = new Date(v);
                  return `${d.getDate()}.${d.getMonth() + 1}.`;
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickFormatter={(v: number) => v.toFixed(0) + " €"}
                width={60}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  fmt(v),
                  name === "portfolio_value" ? "Portfoliowert" : "Investiert",
                ]}
                labelFormatter={(label: string) => new Date(label).toLocaleDateString("de-DE")}
              />
              <Legend
                formatter={(v: string) => v === "portfolio_value" ? "Portfoliowert" : "Investiert"}
              />
              <Line
                type="monotone"
                dataKey="portfolio_value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="invested"
                stroke="#9ca3af"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Käufe-Tabelle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {purchases.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            Noch keine Käufe eingetragen. Starte dein Portfolio mit „Kauf hinzufügen".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Produkt</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Datum</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Anz.</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kaufpreis/Stk</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gesamt bezahlt</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Akt. Preis</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Akt. Wert</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">G/V</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {purchases.map((item) => {
                  const paidTotal = item.purchase_price * item.quantity;
                  const hasPrice = item.current_price != null;
                  const plPositive = (item.pl_abs ?? 0) >= 0;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => setDetailProductId(item.product_id)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{item.product_name}</span>
                          {item.product_url && (
                            <a
                              href={item.product_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-gray-400 hover:text-blue-600 flex-shrink-0"
                              title="Auf Cardmarket öffnen"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                            </a>
                          )}
                        </div>
                        {item.notes && <div className="text-xs text-gray-400 truncate mt-0.5">{item.notes}</div>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                        {new Date(item.purchase_date).toLocaleDateString("de-DE")}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">{fmt(item.purchase_price)}</td>
                      <td className="px-4 py-3 text-right text-gray-700 font-medium whitespace-nowrap">{fmt(paidTotal)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                        {hasPrice ? fmt(item.current_price!) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-medium whitespace-nowrap">
                        {hasPrice ? fmt(item.current_total!) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {hasPrice ? (
                          <span className={`inline-flex flex-col items-end font-semibold ${plPositive ? "text-green-600" : "text-red-600"}`}>
                            <span>{fmt(item.pl_abs!)}</span>
                            {item.pl_pct != null && (
                              <span className="text-xs font-normal">{fmtPct(item.pl_pct)}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={(e) => openEdit(item, e)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
                            title="Bearbeiten"
                          >
                            <IconEdit />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                            title="Löschen"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formular-Modal (Hinzufügen / Bearbeiten) */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editTarget ? "Kauf bearbeiten" : "Kauf hinzufügen"}
      >
        <div className="space-y-4">
          {!editTarget && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Produkt *</label>
              <select
                className={inputCls}
                value={form.product_id}
                onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
              >
                <option value="">— Produkt wählen —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.set_name ? ` (${p.set_name})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {editTarget && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Produkt</label>
              <div className="px-3 py-2 text-sm bg-gray-50 rounded-lg text-gray-700 border border-gray-200">
                {editTarget.product_name}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kaufdatum *</label>
              <input
                type="date"
                className={inputCls}
                value={form.purchase_date}
                onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Anzahl</label>
              <input
                type="number"
                min="1"
                className={inputCls}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kaufpreis pro Stück (€) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className={inputCls}
              value={form.purchase_price}
              onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notizen (optional)</label>
            <input
              type="text"
              placeholder="z.B. gekauft bei Auctionhouse, Zustand NM…"
              className={inputCls}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          {formError && <div className="text-sm text-red-600">{formError}</div>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={closeForm}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Löschen-Bestätigungs-Modal */}
      <Modal
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Kauf löschen"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Möchtest du den Kauf von <strong>{deleteTarget?.product_name}</strong> vom{" "}
            {deleteTarget && new Date(deleteTarget.purchase_date).toLocaleDateString("de-DE")} wirklich löschen?
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? "Löschen…" : "Löschen"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Produktdetail-Modal */}
      {detailProductId != null && (
        <ProductDetailModal
          productId={detailProductId}
          onClose={() => setDetailProductId(null)}
        />
      )}
    </div>
  );
}

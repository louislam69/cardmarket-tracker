import { apiGet, apiPost, apiPatch, apiDelete } from "./client";

export interface PurchaseItem {
  id: number;
  product_id: number;
  product_name: string;
  product_url: string | null;
  purchase_date: string;
  purchase_price: number;
  quantity: number;
  notes: string | null;
  created_at: string | null;
  current_price: number | null;
  current_total: number | null;
  pl_abs: number | null;
  pl_pct: number | null;
}

export interface PortfolioSummary {
  total_invested: number;
  current_value: number;
  pl_abs: number;
  pl_pct: number | null;
  purchase_count: number;
}

export interface PortfolioHistoryPoint {
  date: string;
  portfolio_value: number;
  invested: number;
}

export interface PurchaseCreatePayload {
  product_id: number;
  purchase_date: string;
  purchase_price: number;
  quantity: number;
  notes?: string;
}

export interface PurchaseUpdatePayload {
  purchase_date?: string;
  purchase_price?: number;
  quantity?: number;
  notes?: string;
}

export const fetchPortfolioPurchases = () =>
  apiGet<PurchaseItem[]>("/portfolio/");

export const fetchPortfolioSummary = () =>
  apiGet<PortfolioSummary>("/portfolio/summary");

export const fetchPortfolioHistory = () =>
  apiGet<PortfolioHistoryPoint[]>("/portfolio/history");

export const addPurchase = (data: PurchaseCreatePayload) =>
  apiPost<PurchaseItem>("/portfolio/", data);

export const updatePurchase = (id: number, data: PurchaseUpdatePayload) =>
  apiPatch<PurchaseItem>(`/portfolio/${id}`, data);

export const deletePurchase = (id: number) =>
  apiDelete(`/portfolio/${id}`);

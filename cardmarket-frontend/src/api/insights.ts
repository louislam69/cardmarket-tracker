import { apiGet } from "./client";

// ==== Dashboard Summary ====

export interface SummaryStats {
  total_products: number;
  total_crawls: number;
  last_crawl_at: string | null;
  total_product_stats_rows: number;
  product_stats_with_realistic_price: number;
  products_in_last_crawl: number;
  offers_in_last_crawl: number;
}

export async function fetchSummary(): Promise<SummaryStats> {
  return apiGet<SummaryStats>("/insights/summary");
}

// ==== Latest Prices ====

export type LatestPriceItem = {
  product_id: number;
  product_name: string;
  last_crawled_at: string;
  from_price: number | null;
  realistic_price: number | null;
  price_trend: number | null;
  avg_30d: number | null;
  avg_7d: number | null;
  avg_1d: number | null;
  offers_used: number | null;
  release_date: string | null;
};

export type LatestPricesResponse = {
  items: LatestPriceItem[];
  total: number;
  limit: number;
  offset: number;
};

export async function fetchLatestPrices(
  limit = 25,
  offset = 0,
  search?: string,
  minPrice?: number,
  maxPrice?: number,
  sortBy?: string,
  sortOrder?: "asc" | "desc",
): Promise<LatestPricesResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (search) params.set("search", search);
  if (minPrice !== undefined) params.set("min_price", String(minPrice));
  if (maxPrice !== undefined) params.set("max_price", String(maxPrice));
  if (sortBy) params.set("sort_by", sortBy);
  if (sortOrder) params.set("sort_order", sortOrder);
  return apiGet<LatestPricesResponse>(`/insights/latest-prices?${params.toString()}`);
}

// ==== Price History ====

export interface PriceHistoryPoint {
  product_id: number;
  product_name: string;
  crawled_at: string;
  from_price: number | null;
  realistic_price: number | null;
}

export async function fetchPriceHistory(productId: number): Promise<PriceHistoryPoint[]> {
  return apiGet<PriceHistoryPoint[]>(`/insights/price-history/${productId}`);
}

// ==== Top Movers ====

export interface TopMoverItem {
  product_id: number;
  product_name: string;
  last_crawled_at: string;
  prev_crawled_at: string;
  last_price: number;
  prev_price: number;
  abs_change: number;
  rel_change_pct: number;
}

export interface TopMoversResponse {
  total: number;
  limit: number;
  offset: number;
  items: TopMoverItem[];
}

export async function fetchTopMovers(
  limit = 50,
  offset = 0,
  direction: "up" | "down" | "both" = "both",
  minChangePct = 0,
  search?: string,
): Promise<TopMoversResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    direction,
    min_change_pct: String(minChangePct),
  });
  if (search) params.set("search", search);
  return apiGet<TopMoversResponse>(`/insights/top-movers?${params.toString()}`);
}

// ==== Monthly MoM ====

export interface MonthlyMoMItem {
  product_id: number;
  product_name: string;
  month: string;
  prev_month: string;
  avg_realistic_price: number;
  prev_avg_price: number;
  abs_change: number;
  rel_change_pct: number;
  num_points: number;
}

export interface MonthlyMoMResponse {
  total: number;
  limit: number;
  offset: number;
  items: MonthlyMoMItem[];
}

export async function fetchMonthlyMoM(
  limit = 50,
  offset = 0,
  direction: "up" | "down" | "both" = "both",
  productId?: number,
  search?: string,
): Promise<MonthlyMoMResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), direction });
  if (productId !== undefined) params.set("product_id", String(productId));
  if (search) params.set("search", search);
  return apiGet<MonthlyMoMResponse>(`/insights/monthly-mom?${params.toString()}`);
}

// ==== Volatility ====

export interface VolatilityItem {
  product_id: number;
  product_name: string;
  avg_realistic_price: number;
  stddev_price: number;
  cv: number;
  min_price: number;
  max_price: number;
  price_range: number;
  crawl_count: number;
}

export interface VolatilityResponse {
  total: number;
  limit: number;
  offset: number;
  items: VolatilityItem[];
}

export async function fetchVolatility(
  limit = 50,
  offset = 0,
  search?: string,
): Promise<VolatilityResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (search) params.set("search", search);
  return apiGet<VolatilityResponse>(`/insights/volatility?${params.toString()}`);
}

// ==== Set Summary ====

export interface SetSummaryItem {
  set_name: string | null;
  product_count: number;
  avg_realistic_price: number | null;
  total_available_items: number | null;
  min_price: number | null;
  max_price: number | null;
}

export interface SetSummaryResponse {
  items: SetSummaryItem[];
}

export async function fetchSetSummary(): Promise<SetSummaryResponse> {
  return apiGet<SetSummaryResponse>("/insights/set-summary");
}

// ==== Percentile Position ====

export interface PercentilePosition {
  product_id: number;
  product_name: string;
  current_price: number;
  historical_min: number;
  historical_max: number;
  historical_avg: number;
  percentile_position: number;
  crawl_count: number;
}

export async function fetchPercentilePosition(productId: number): Promise<PercentilePosition> {
  return apiGet<PercentilePosition>(`/insights/percentile-position/${productId}`);
}

// ==== Offer Distribution ====

export interface ConditionBreakdown {
  condition: string;
  count: number;
  min_price: number | null;
  max_price: number | null;
  avg_price: number | null;
}

export interface OfferDistribution {
  product_id: number;
  product_name: string;
  crawl_id: number;
  crawled_at: string;
  seller_count: number;
  total_qty: number;
  offer_count: number;
  min_price: number;
  max_price: number;
  median_price: number;
  p25_price: number;
  p75_price: number;
  avg_price: number;
  conditions: ConditionBreakdown[];
}

export async function fetchOfferDistribution(productId: number): Promise<OfferDistribution> {
  return apiGet<OfferDistribution>(`/insights/offer-distribution/${productId}`);
}

// ==== Value Ratio ====

export interface ValueRatioItem {
  product_id: number;
  product_name: string;
  sealed_price: number;
  singles_sum: number;
  value_ratio: number;
  priced_components: number;
}

export interface ValueRatiosResponse {
  total: number;
  limit: number;
  offset: number;
  items: ValueRatioItem[];
}

export async function fetchValueRatios(
  limit = 50,
  offset = 0,
  search?: string,
  sortBy = "value_ratio",
  sortOrder: "asc" | "desc" = "desc",
): Promise<ValueRatiosResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    sort_by: sortBy,
    sort_order: sortOrder,
  });
  if (search) params.set("search", search);
  return apiGet<ValueRatiosResponse>(`/insights/value-ratios?${params.toString()}`);
}

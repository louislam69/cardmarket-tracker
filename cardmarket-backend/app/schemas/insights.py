# app/schemas/insights.py
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from typing import List
from datetime import datetime, date
from pydantic import BaseModel
from typing import Optional, List


class LatestPrice(BaseModel):
    product_id: int
    product_name: str
    last_crawled_at: datetime
    available_items: Optional[int]
    from_price: Optional[float]
    price_trend: Optional[float]
    avg_30d: Optional[float]
    avg_7d: Optional[float]
    avg_1d: Optional[float]
    realistic_price: Optional[float]
    offers_used: Optional[int]
    release_date: Optional[date]


class PaginatedLatestPrices(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[LatestPrice]


class PriceHistoryPoint(BaseModel):
    product_id: int
    product_name: str
    crawled_at: datetime
    from_price: Optional[float]
    realistic_price: Optional[float]

class TopMover(BaseModel):
    product_id: int
    product_name: str
    last_crawled_at: datetime
    prev_crawled_at: datetime
    last_price: float
    prev_price: float
    abs_change: float
    rel_change_pct: float


class PaginatedTopMovers(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[TopMover]

class MonthlyPrice(BaseModel):
    product_id: int
    product_name: str
    month: str
    avg_realistic_price: float
    num_points: int


class MonthlyMoM(BaseModel):
    product_id: int
    product_name: str
    month: str
    prev_month: str
    avg_realistic_price: float
    prev_avg_price: float
    abs_change: float
    rel_change_pct: float
    num_points: int


class PaginatedMonthlyMoM(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[MonthlyMoM]

class SummaryStats(BaseModel):
    total_products: int
    total_crawls: int
    last_crawl_at: Optional[datetime]
    total_product_stats_rows: int
    product_stats_with_realistic_price: int
    products_in_last_crawl: int
    offers_in_last_crawl: int


# ==== Volatility ====

class VolatilityItem(BaseModel):
    product_id: int
    product_name: str
    avg_realistic_price: float
    stddev_price: float
    cv: float
    min_price: float
    max_price: float
    price_range: float
    crawl_count: int


class PaginatedVolatility(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[VolatilityItem]


# ==== Set Summary ====

class SetSummaryItem(BaseModel):
    set_name: Optional[str]
    product_count: int
    avg_realistic_price: Optional[float]
    total_available_items: Optional[int]
    min_price: Optional[float]
    max_price: Optional[float]


class SetSummaryResponse(BaseModel):
    items: List[SetSummaryItem]


# ==== Percentile Position ====

class PercentilePosition(BaseModel):
    product_id: int
    product_name: str
    current_price: float
    historical_min: float
    historical_max: float
    historical_avg: float
    percentile_position: float
    crawl_count: int


# ==== Offer Distribution ====

class ConditionBreakdown(BaseModel):
    condition: str
    count: int
    min_price: Optional[float]
    max_price: Optional[float]
    avg_price: Optional[float]


class OfferDistribution(BaseModel):
    product_id: int
    product_name: str
    crawl_id: int
    crawled_at: str
    seller_count: int
    total_qty: int
    offer_count: int
    min_price: float
    max_price: float
    median_price: float
    p25_price: float
    p75_price: float
    avg_price: float
    conditions: List[ConditionBreakdown]


# ==== Value Ratio ====

class ValueRatioItem(BaseModel):
    product_id: int
    product_name: str
    sealed_price: float
    singles_sum: float
    value_ratio: float
    priced_components: int
    sealed_url: Optional[str] = None
    component_url: Optional[str] = None


class PaginatedValueRatios(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[ValueRatioItem]
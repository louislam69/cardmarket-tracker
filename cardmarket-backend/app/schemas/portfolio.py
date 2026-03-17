from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class PurchaseCreate(BaseModel):
    product_id: int
    purchase_date: date
    purchase_price: float
    quantity: int = 1
    notes: Optional[str] = None


class PurchaseUpdate(BaseModel):
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = None
    quantity: Optional[int] = None
    notes: Optional[str] = None


class PurchaseItem(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_url: Optional[str]
    purchase_date: date
    purchase_price: float
    quantity: int
    notes: Optional[str]
    created_at: Optional[datetime]
    current_price: Optional[float]
    current_total: Optional[float]
    pl_abs: Optional[float]
    pl_pct: Optional[float]


class PortfolioSummary(BaseModel):
    total_invested: float
    current_value: float
    pl_abs: float
    pl_pct: Optional[float]
    purchase_count: int


class PortfolioHistoryPoint(BaseModel):
    date: str
    portfolio_value: float
    invested: float

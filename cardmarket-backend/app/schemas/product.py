# app/schemas/product.py
from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import date


class ProductBase(BaseModel):
    name: str
    cardmarket_url: HttpUrl
    game: Optional[str] = "pokemon"
    language: Optional[str] = "de"
    set_name: Optional[str] = None
    release_date: Optional[date] = None
    is_active: Optional[bool] = True


class ProductCreate(ProductBase):
    pass  # momentan keine extra Felder


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    game: Optional[str] = None
    language: Optional[str] = None
    set_name: Optional[str] = None
    release_date: Optional[date] = None
    is_active: Optional[bool] = None


class ProductOut(ProductBase):
    id: int

    class Config:
        orm_mode = True
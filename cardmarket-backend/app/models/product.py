# app/models/product.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, func
from ..database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    cardmarket_url = Column(String, unique=True, index=True, nullable=False)
    game = Column(String, default="pokemon")   # z.B. "pokemon"
    language = Column(String, default="de")
    set_name = Column(String, nullable=True)
    release_date = Column(Date, nullable=True)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
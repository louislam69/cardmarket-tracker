from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from . import models
from .routers import products
from app.routers import insights
from app.routers import sealed

# DB-Tabellen aus den Models erstellen
Base.metadata.create_all(bind=engine)

# Raw-SQL-Tabellen anlegen (nicht ORM-verwaltet)
from app.db_insights import fetch_all
import os, sqlite3
from urllib.parse import urlparse as _urlparse

def _raw_db_path() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./app.db")
    path = _urlparse(url).path
    if path.startswith("/") and len(path) >= 3 and path[2] == ":":
        path = path[1:]
    return path.lstrip("/")

with sqlite3.connect(_raw_db_path()) as _conn:
    _conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sealed_contents (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id          INTEGER NOT NULL REFERENCES products(id),
            component_type      TEXT    NOT NULL,
            qty                 INTEGER NOT NULL,
            linked_product_id   INTEGER REFERENCES products(id),
            UNIQUE(product_id, component_type)
        )
        """
    )

app = FastAPI(
    title="Cardmarket Tracker API",
    version="0.1.0",
)

origins = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # hier NUR deine Frontend-URLs rein
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Cardmarket Backend läuft 🚀"}


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}


# Product-Routen registrieren
app.include_router(products.router, prefix="/products", tags=["products"])

app.include_router(insights.router)
app.include_router(sealed.router)
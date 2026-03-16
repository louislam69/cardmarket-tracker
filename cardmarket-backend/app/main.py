import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from . import models
from .routers import products
from app.routers import insights
from app.routers import sealed
from app.auth import get_current_user

# DB-Tabellen aus den Models erstellen (und via Alembic verwaltete Tabellen existieren bereits)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Cardmarket Tracker API",
    version="0.1.0",
)

_origins_raw = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
)
origins = [o.strip() for o in _origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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


_auth = [Depends(get_current_user)]

# Product-Routen registrieren
app.include_router(products.router, prefix="/products", tags=["products"], dependencies=_auth)

app.include_router(insights.router, dependencies=_auth)
app.include_router(sealed.router, dependencies=_auth)

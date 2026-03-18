from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from typing import List, Optional

from app.auth import get_current_user
from app.database import engine
from app.db_insights import fetch_all
from app.schemas.portfolio import (
    PurchaseCreate,
    PurchaseUpdate,
    PurchaseItem,
    PortfolioSummary,
    PortfolioHistoryPoint,
)

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


# ---------------------------------------------------------------------------
# Helper: enkricherten Kauf laden (JOIN mit aktuellem Preis)
# ---------------------------------------------------------------------------

_SELECT_PURCHASE = """
    SELECT
        up.id,
        up.product_id,
        p.name AS product_name,
        p.cardmarket_url AS product_url,
        up.purchase_date,
        up.purchase_price,
        up.quantity,
        up.notes,
        up.created_at,
        ps.realistic_price AS current_price
    FROM user_purchases up
    JOIN products p ON p.id = up.product_id
    LEFT JOIN product_stats ps
        ON ps.product_id = up.product_id
        AND ps.crawl_id = (SELECT id FROM crawls ORDER BY crawl_timestamp DESC LIMIT 1)
    WHERE up.id = ? AND up.user_id = ?
"""


def _enrich(row: dict) -> PurchaseItem:
    cp: Optional[float] = row.get("current_price")
    qty: int = row["quantity"]
    paid_total = row["purchase_price"] * qty
    current_total = (cp * qty) if cp is not None else None
    pl_abs = (current_total - paid_total) if current_total is not None else None
    pl_pct = (pl_abs / paid_total * 100) if (pl_abs is not None and paid_total > 0) else None
    return PurchaseItem(
        id=row["id"],
        product_id=row["product_id"],
        product_name=row["product_name"],
        product_url=row.get("product_url"),
        purchase_date=row["purchase_date"],
        purchase_price=row["purchase_price"],
        quantity=qty,
        notes=row.get("notes"),
        created_at=row.get("created_at"),
        current_price=cp,
        current_total=current_total,
        pl_abs=pl_abs,
        pl_pct=pl_pct,
    )


# ---------------------------------------------------------------------------
# GET /portfolio/ — alle Käufe des eingeloggten Nutzers
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[PurchaseItem])
def list_purchases(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    rows = fetch_all(
        """
        SELECT
            up.id,
            up.product_id,
            p.name AS product_name,
            p.cardmarket_url AS product_url,
            up.purchase_date,
            up.purchase_price,
            up.quantity,
            up.notes,
            up.created_at,
            ps.realistic_price AS current_price
        FROM user_purchases up
        JOIN products p ON p.id = up.product_id
        LEFT JOIN product_stats ps
            ON ps.product_id = up.product_id
            AND ps.crawl_id = (SELECT id FROM crawls ORDER BY crawl_timestamp DESC LIMIT 1)
        WHERE up.user_id = ?
        ORDER BY up.purchase_date DESC, up.id DESC
        """,
        (user_id,),
    )
    return [_enrich(r) for r in rows]


# ---------------------------------------------------------------------------
# POST /portfolio/ — Kauf anlegen
# ---------------------------------------------------------------------------

@router.post("/", response_model=PurchaseItem, status_code=201)
def add_purchase(body: PurchaseCreate, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            result = conn.execute(
                text(
                    """
                    INSERT INTO user_purchases (user_id, product_id, purchase_date, purchase_price, quantity, notes)
                    VALUES (:user_id, :product_id, :purchase_date, :purchase_price, :quantity, :notes)
                    RETURNING id
                    """
                ),
                {
                    "user_id": user_id,
                    "product_id": body.product_id,
                    "purchase_date": body.purchase_date,
                    "purchase_price": body.purchase_price,
                    "quantity": body.quantity,
                    "notes": body.notes,
                },
            )
            new_id = result.scalar()
        else:
            result = conn.execute(
                text(
                    """
                    INSERT INTO user_purchases (user_id, product_id, purchase_date, purchase_price, quantity, notes)
                    VALUES (:user_id, :product_id, :purchase_date, :purchase_price, :quantity, :notes)
                    """
                ),
                {
                    "user_id": user_id,
                    "product_id": body.product_id,
                    "purchase_date": body.purchase_date,
                    "purchase_price": body.purchase_price,
                    "quantity": body.quantity,
                    "notes": body.notes,
                },
            )
            new_id = result.lastrowid

    rows = fetch_all(_SELECT_PURCHASE, (new_id, user_id))
    if not rows:
        raise HTTPException(status_code=404, detail="Kauf nicht gefunden")
    return _enrich(rows[0])


# ---------------------------------------------------------------------------
# PATCH /portfolio/{id} — Kauf aktualisieren
# ---------------------------------------------------------------------------

@router.patch("/{purchase_id}", response_model=PurchaseItem)
def update_purchase(
    purchase_id: int,
    body: PurchaseUpdate,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["sub"]
    # Ownership prüfen
    existing = fetch_all(
        "SELECT id FROM user_purchases WHERE id = ? AND user_id = ?",
        (purchase_id, user_id),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Kauf nicht gefunden")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        rows = fetch_all(_SELECT_PURCHASE, (purchase_id, user_id))
        return _enrich(rows[0])

    set_clauses = ", ".join(f"{k} = :{k}" for k in updates)
    updates["purchase_id"] = purchase_id
    updates["user_id"] = user_id

    with engine.begin() as conn:
        conn.execute(
            text(f"UPDATE user_purchases SET {set_clauses} WHERE id = :purchase_id AND user_id = :user_id"),
            updates,
        )

    rows = fetch_all(_SELECT_PURCHASE, (purchase_id, user_id))
    return _enrich(rows[0])


# ---------------------------------------------------------------------------
# DELETE /portfolio/{id} — Kauf löschen
# ---------------------------------------------------------------------------

@router.delete("/{purchase_id}", status_code=204)
def delete_purchase(purchase_id: int, current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    existing = fetch_all(
        "SELECT id FROM user_purchases WHERE id = ? AND user_id = ?",
        (purchase_id, user_id),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Kauf nicht gefunden")
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM user_purchases WHERE id = :id AND user_id = :user_id"),
            {"id": purchase_id, "user_id": user_id},
        )


# ---------------------------------------------------------------------------
# GET /portfolio/summary — KPI-Zusammenfassung
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=PortfolioSummary)
def get_summary(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    rows = fetch_all(
        """
        SELECT
            COUNT(up.id) AS purchase_count,
            COALESCE(SUM(up.purchase_price * up.quantity), 0) AS total_invested,
            COALESCE(SUM(CASE WHEN ps.realistic_price IS NOT NULL THEN ps.realistic_price * up.quantity ELSE 0 END), 0) AS current_value
        FROM user_purchases up
        LEFT JOIN product_stats ps
            ON ps.product_id = up.product_id
            AND ps.crawl_id = (SELECT id FROM crawls ORDER BY crawl_timestamp DESC LIMIT 1)
        WHERE up.user_id = ?
        """,
        (user_id,),
    )
    row = rows[0] if rows else {}
    total_invested = float(row.get("total_invested") or 0)
    current_value = float(row.get("current_value") or 0)
    pl_abs = current_value - total_invested
    pl_pct = (pl_abs / total_invested * 100) if total_invested > 0 else None
    return PortfolioSummary(
        total_invested=total_invested,
        current_value=current_value,
        pl_abs=pl_abs,
        pl_pct=pl_pct,
        purchase_count=int(row.get("purchase_count") or 0),
    )


# ---------------------------------------------------------------------------
# GET /portfolio/history — Zeitreihe des Portfolio-Werts
# ---------------------------------------------------------------------------

@router.get("/history", response_model=List[PortfolioHistoryPoint])
def get_history(current_user: dict = Depends(get_current_user)):
    user_id = current_user["sub"]
    rows = fetch_all(
        """
        SELECT
            CAST(c.crawl_timestamp AS DATE) AS date,
            SUM(up.quantity * ps.realistic_price) AS portfolio_value,
            SUM(up.quantity * up.purchase_price) AS invested
        FROM user_purchases up
        JOIN product_stats ps ON ps.product_id = up.product_id
        JOIN crawls c ON c.id = ps.crawl_id
        WHERE up.user_id = ?
            AND CAST(c.crawl_timestamp AS DATE) >= up.purchase_date
            AND ps.realistic_price > 0
        GROUP BY CAST(c.crawl_timestamp AS DATE)
        ORDER BY date ASC
        """,
        (user_id,),
    )
    return [
        PortfolioHistoryPoint(
            date=str(r["date"]),
            portfolio_value=float(r["portfolio_value"]),
            invested=float(r["invested"]),
        )
        for r in rows
    ]

from fastapi import APIRouter
from typing import List
from app.db_insights import fetch_all
from app.schemas.sealed import SealedContentItem, SealedContentsResponse

router = APIRouter(prefix="/sealed-contents", tags=["sealed"])


@router.get("/", response_model=List[SealedContentItem])
def list_all_sealed_contents():
    """Alle sealed_contents-Zeilen mit Produktnamen (für Übersicht / Admin)."""
    rows = fetch_all(
        """
        SELECT
            sc.id,
            sc.product_id,
            p.name  AS product_name,
            sc.component_type,
            sc.qty,
            sc.linked_product_id,
            lp.name AS linked_product_name
        FROM sealed_contents sc
        JOIN  products p  ON p.id  = sc.product_id
        LEFT JOIN products lp ON lp.id = sc.linked_product_id
        ORDER BY p.name ASC, sc.component_type ASC
        """
    )
    return [SealedContentItem(**r) for r in rows]


@router.get("/{product_id}", response_model=SealedContentsResponse)
def get_sealed_contents(product_id: int):
    """Inhalte eines Sealed-Produkts. Gibt leere items-Liste zurück wenn keine Daten vorhanden."""
    rows = fetch_all(
        """
        SELECT
            sc.id,
            sc.product_id,
            sc.component_type,
            sc.qty,
            sc.linked_product_id,
            lp.name AS linked_product_name
        FROM sealed_contents sc
        LEFT JOIN products lp ON lp.id = sc.linked_product_id
        WHERE sc.product_id = ?
        ORDER BY sc.component_type ASC
        """,
        (product_id,),
    )
    return SealedContentsResponse(
        product_id=product_id,
        items=[SealedContentItem(**r) for r in rows],
    )

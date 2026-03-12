from pydantic import BaseModel
from typing import Optional, List


class SealedContentItem(BaseModel):
    id: int
    product_id: int
    component_type: str
    qty: int
    linked_product_id: Optional[int] = None
    linked_product_name: Optional[str] = None
    product_name: Optional[str] = None  # nur für List-Endpoint


class SealedContentsResponse(BaseModel):
    product_id: int
    items: List[SealedContentItem]

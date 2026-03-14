# app/db_insights.py
import re
from typing import Any, Optional, Tuple, List, Dict
from sqlalchemy import text
from app.database import engine


def fetch_all(query: str, params: Optional[Tuple[Any, ...]] = None) -> List[Dict[str, Any]]:
    """
    Dialect-agnostischer SQL-Helper (SQLite + PostgreSQL).
    Konvertiert positionale ? zu benannten :p0, :p1, ... für SQLAlchemy text().
    """
    if params is None:
        params = ()

    named_params: Dict[str, Any] = {}
    counter = [0]

    def replace(m: re.Match) -> str:
        key = f"p{counter[0]}"
        named_params[key] = params[counter[0]]
        counter[0] += 1
        return f":{key}"

    named_query = re.sub(r"\?", replace, query)

    with engine.connect() as conn:
        result = conn.execute(text(named_query), named_params)
        return [dict(row._mapping) for row in result]

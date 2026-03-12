# app/db_insights.py
import os
import sqlite3
from urllib.parse import urlparse
from typing import Any, Iterable, Optional, Tuple, List, Dict

def _get_sqlite_path_from_database_url(database_url: str) -> str:
    # Expected formats:
    # sqlite:///./app.db
    # sqlite:///D:/cardmarket-backend/app.db
    if not database_url.startswith("sqlite"):
        raise ValueError("DATABASE_URL is not sqlite")

    # remove scheme
    # sqlite:///./app.db  -> path = /./app.db
    parsed = urlparse(database_url)
    path = parsed.path

    # On Windows, parsed.path may start with /D:/...
    if path.startswith("/") and len(path) >= 3 and path[2] == ":":
        path = path[1:]

    # If relative path like ./app.db, keep it relative to current working dir
    if path.startswith("/"):
        path = path.lstrip("/")

    return path

def fetch_all(query: str, params: Optional[Tuple[Any, ...]] = None) -> List[Dict[str, Any]]:
    """
    SQLite-only fetch helper.
    Returns list of dict rows.
    """
    database_url = os.getenv("DATABASE_URL", "sqlite:///./app.db")
    sqlite_path = _get_sqlite_path_from_database_url(database_url)

    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    if params is None:
        params = ()

    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()

    return [dict(r) for r in rows]

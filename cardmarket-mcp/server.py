import os
import httpx
from mcp.server.fastmcp import FastMCP

BACKEND_URL = "https://cardmarket-backend-production-d772.up.railway.app"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ygpgvrkbzmxuqfkypdpi.supabase.co")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_EMAIL = os.environ.get("SUPABASE_EMAIL", "")
SUPABASE_PASSWORD = os.environ.get("SUPABASE_PASSWORD", "")

mcp = FastMCP("cardmarket-insights")


def get_supabase_token() -> str:
    """Loggt sich bei Supabase ein und gibt den Access Token zurück."""
    r = httpx.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        json={"email": SUPABASE_EMAIL, "password": SUPABASE_PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        raise RuntimeError(f"Supabase-Login fehlgeschlagen: HTTP {r.status_code} – {r.text[:200]}")
    return r.json()["access_token"]


@mcp.tool()
def fetch_cardmarket_insights() -> str:
    """
    Ruft Top-Mover- und Value-Ratio-Daten vom Cardmarket-Backend ab.
    Gibt beide Endpunkte als JSON-String zurück, bereit zur Analyse für X-Posts.
    """
    try:
        token = get_supabase_token()
    except RuntimeError as e:
        return str(e)

    headers = {"Authorization": f"Bearer {token}"}

    with httpx.Client(timeout=30) as client:
        r1 = client.get(
            f"{BACKEND_URL}/insights/top-movers",
            params={"limit": 50, "direction": "both", "min_change_pct": 0},
            headers=headers,
        )
        if r1.status_code != 200:
            return f"Fehler beim Abrufen von top-movers: HTTP {r1.status_code} – {r1.text[:200]}"
        top_movers = r1.json()

        r2 = client.get(
            f"{BACKEND_URL}/insights/value-ratios",
            params={"limit": 50, "sort_by": "value_ratio", "sort_order": "desc"},
            headers=headers,
        )
        if r2.status_code != 200:
            return f"Fehler beim Abrufen von value-ratios: HTTP {r2.status_code} – {r2.text[:200]}"
        value_ratios = r2.json()

    return (
        f"=== TOP MOVERS ===\n{top_movers}\n\n"
        f"=== VALUE RATIOS ===\n{value_ratios}"
    )


if __name__ == "__main__":
    mcp.run()

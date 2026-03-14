# app/routers/insights.py
from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from app.db_insights import fetch_all
from app.schemas.insights import (
    PriceHistoryPoint,
    PaginatedLatestPrices,
    PaginatedTopMovers,
    PaginatedMonthlyMoM,
    SummaryStats,
    PaginatedVolatility,
    SetSummaryResponse,
    PercentilePosition,
    OfferDistribution,
    ConditionBreakdown,
    PaginatedValueRatios,
)

router = APIRouter(prefix="/insights", tags=["insights"])


# -------------------------
# /latest-prices (SQLite)
# -------------------------
LATEST_PRICES_SORT_COLUMNS = {
    "product_name":    "product_name",
    "realistic_price": "realistic_price",
    "from_price":      "from_price",
    "price_trend":     "price_trend",
    "avg_30d":         "avg_30d",
    "avg_7d":          "avg_7d",
    "avg_1d":          "avg_1d",
    "last_crawled_at": "last_crawled_at",
    "release_date":    "release_date",
}


@router.get("/latest-prices", response_model=PaginatedLatestPrices)
def get_latest_prices(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    search: Optional[str] = Query(None, description="Filter nach Produktname (LIKE)"),
    sort_by: str = Query("product_name", description="Spalte für Sortierung"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
):
    """
    Liefert pro Produkt den letzten Crawl mit realistischer Preisinfo.
    SQLite-only (keine Views), saubere Pagination.
    """

    base_cte = """
    WITH latest AS (
      SELECT
        ps.product_id,
        p.name AS product_name,
        p.release_date AS release_date,
        c.crawl_timestamp AS last_crawled_at,
        ps.available_items,
        ps.from_price,
        ps.price_trend,
        ps.avg_30d,
        ps.avg_7d,
        ps.avg_1d,
        ps.realistic_price,
        ps.offers_used,
        ROW_NUMBER() OVER (
          PARTITION BY ps.product_id
          ORDER BY c.crawl_timestamp DESC
        ) AS rn
      FROM product_stats ps
      JOIN crawls c ON c.id = ps.crawl_id
      JOIN products p ON p.id = ps.product_id
      WHERE ps.realistic_price IS NOT NULL
    )
    """

    where_clauses = ["rn = 1"]
    params: list = []

    if min_price is not None:
        where_clauses.append("realistic_price >= ?")
        params.append(min_price)

    if max_price is not None:
        where_clauses.append("realistic_price <= ?")
        params.append(max_price)

    if search:
        where_clauses.append("LOWER(product_name) LIKE '%' || LOWER(?) || '%'")
        params.append(search)

    where_sql = " AND ".join(where_clauses)

    count_query = base_cte + f"""
        SELECT COUNT(*) AS total
        FROM latest
        WHERE {where_sql}
    """
    total = fetch_all(count_query, tuple(params))[0]["total"]

    col = LATEST_PRICES_SORT_COLUMNS.get(sort_by, "product_name")
    direction = "DESC" if sort_order == "desc" else "ASC"
    # NULLs always last regardless of direction
    order_sql = f"CASE WHEN {col} IS NULL THEN 1 ELSE 0 END, {col} {direction}"

    data_query = base_cte + f"""
        SELECT
            product_id,
            product_name,
            release_date,
            last_crawled_at,
            available_items,
            from_price,
            price_trend,
            avg_30d,
            avg_7d,
            avg_1d,
            realistic_price,
            offers_used
        FROM latest
        WHERE {where_sql}
        ORDER BY {order_sql}
        LIMIT ? OFFSET ?
    """
    rows = fetch_all(data_query, tuple(params + [limit, offset]))

    return PaginatedLatestPrices(
        total=total,
        limit=limit,
        offset=offset,
        items=rows,
    )


# -------------------------
# /price-history/{product_id} (SQLite)
# -------------------------
@router.get("/price-history/{product_id}", response_model=List[PriceHistoryPoint])
def get_price_history(product_id: int):
    """
    Liefert den Preisverlauf (from_price & realistic_price) für ein Produkt.
    SQLite-only (keine View).
    """
    query = """
        SELECT
            ps.product_id,
            p.name AS product_name,
            c.crawl_timestamp AS crawled_at,
            ps.from_price,
            ps.realistic_price
        FROM product_stats ps
        JOIN crawls c ON c.id = ps.crawl_id
        JOIN products p ON p.id = ps.product_id
        WHERE ps.product_id = ?
        ORDER BY c.crawl_timestamp ASC;
    """
    rows = fetch_all(query, (product_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Keine Daten für dieses Produkt gefunden.")
    return rows


# -------------------------
# /top-movers (SQLite)
# -------------------------
@router.get("/top-movers", response_model=PaginatedTopMovers)
def get_top_movers(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    direction: str = Query("up", pattern="^(up|down|both)$"),
    min_change_pct: Optional[float] = Query(
        5.0,
        description="Minimale prozentuale Veränderung (absolut) in %"
    ),
    search: Optional[str] = Query(None, description="Filter nach Produktname (LIKE)"),
):
    """
    Liefert Produkte mit der größten relativen Preisänderung zwischen
    letztem und vorletztem Crawl (basierend auf realistic_price).
    direction: up | down | both
    """

    base_cte = """
    WITH ranked AS (
      SELECT
        ps.product_id,
        p.name AS product_name,
        c.crawl_timestamp AS crawled_at,
        ps.realistic_price,
        ROW_NUMBER() OVER (
          PARTITION BY ps.product_id
          ORDER BY c.crawl_timestamp DESC
        ) AS rn
      FROM product_stats ps
      JOIN crawls c ON c.id = ps.crawl_id
      JOIN products p ON p.id = ps.product_id
      WHERE ps.realistic_price IS NOT NULL
    ),
    last_two AS (
      SELECT
        r1.product_id,
        r1.product_name,
        r1.crawled_at AS last_crawled_at,
        r2.crawled_at AS prev_crawled_at,
        r1.realistic_price AS last_price,
        r2.realistic_price AS prev_price,
        (r1.realistic_price - r2.realistic_price) AS abs_change,
        CASE
          WHEN r2.realistic_price IS NULL OR r2.realistic_price = 0 THEN NULL
          ELSE ((r1.realistic_price - r2.realistic_price) / r2.realistic_price) * 100.0
        END AS rel_change_pct
      FROM ranked r1
      JOIN ranked r2
        ON r2.product_id = r1.product_id
       AND r2.rn = 2
      WHERE r1.rn = 1
    )
    """

    where_clauses = ["1=1"]
    params: list = []

    if direction == "up":
        where_clauses.append("rel_change_pct > 0")
    elif direction == "down":
        where_clauses.append("rel_change_pct < 0")

    if min_change_pct is not None:
        where_clauses.append("rel_change_pct IS NOT NULL AND ABS(rel_change_pct) >= ?")
        params.append(min_change_pct)

    if search:
        where_clauses.append("LOWER(product_name) LIKE '%' || LOWER(?) || '%'")
        params.append(search)

    where_sql = " AND ".join(where_clauses)

    count_query = base_cte + f"""
        SELECT COUNT(*) AS total
        FROM last_two
        WHERE {where_sql}
    """
    total = fetch_all(count_query, tuple(params))[0]["total"]

    order_by = "rel_change_pct DESC"
    if direction == "down":
        order_by = "rel_change_pct ASC"

    data_query = base_cte + f"""
        SELECT
            product_id,
            product_name,
            last_crawled_at,
            prev_crawled_at,
            last_price,
            prev_price,
            abs_change,
            rel_change_pct
        FROM last_two
        WHERE {where_sql}
        ORDER BY {order_by}
        LIMIT ? OFFSET ?
    """
    rows = fetch_all(data_query, tuple(params + [limit, offset]))

    return PaginatedTopMovers(
        total=total,
        limit=limit,
        offset=offset,
        items=rows,
    )


# -------------------------
# /monthly-mom (SQLite)
# -------------------------
@router.get("/monthly-mom", response_model=PaginatedMonthlyMoM)
def get_monthly_mom(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    direction: str = Query("both", pattern="^(up|down|both)$"),
    min_change_pct: Optional[float] = Query(
        None,
        description="Minimale prozentuale Veränderung (absolut) in %"
    ),
    product_id: Optional[int] = Query(
        None,
        description="Wenn gesetzt, nur dieses Produkt (komplette Monats-Historie)"
    ),
    search: Optional[str] = Query(None, description="Filter nach Produktname (LIKE)"),
):
    """
    Month-over-Month Vergleich der durchschnittlichen Monats-Realistic-Preise.
    """

    base_cte = """
    WITH monthly AS (
      SELECT
        ps.product_id,
        p.name AS product_name,
        SUBSTR(c.crawl_timestamp, 1, 7) AS month,
        AVG(ps.realistic_price) AS avg_realistic_price,
        COUNT(*) AS num_points
      FROM product_stats ps
      JOIN crawls c ON c.id = ps.crawl_id
      JOIN products p ON p.id = ps.product_id
      WHERE ps.realistic_price IS NOT NULL
      GROUP BY ps.product_id, p.name, SUBSTR(c.crawl_timestamp, 1, 7)
    ),
    mom AS (
      SELECT
        product_id,
        product_name,
        month,
        LAG(month) OVER (PARTITION BY product_id ORDER BY month) AS prev_month,
        avg_realistic_price,
        LAG(avg_realistic_price) OVER (PARTITION BY product_id ORDER BY month) AS prev_avg_price,
        (avg_realistic_price - LAG(avg_realistic_price) OVER (PARTITION BY product_id ORDER BY month)) AS abs_change,
        CASE
          WHEN LAG(avg_realistic_price) OVER (PARTITION BY product_id ORDER BY month) IS NULL
               OR LAG(avg_realistic_price) OVER (PARTITION BY product_id ORDER BY month) = 0
            THEN NULL
          ELSE (
            (avg_realistic_price - LAG(avg_realistic_price) OVER (PARTITION BY product_id ORDER BY month))
            / LAG(avg_realistic_price) OVER (PARTITION BY product_id ORDER BY month)
          ) * 100.0
        END AS rel_change_pct,
        num_points
      FROM monthly
    )
    """

    where_clauses = ["1=1"]
    params: list = []

    if product_id is not None:
        where_clauses.append("product_id = ?")
        params.append(product_id)

    if search:
        where_clauses.append("LOWER(product_name) LIKE '%' || LOWER(?) || '%'")
        params.append(search)

    if direction == "up":
        where_clauses.append("rel_change_pct > 0")
    elif direction == "down":
        where_clauses.append("rel_change_pct < 0")

    if min_change_pct is not None:
        where_clauses.append("rel_change_pct IS NOT NULL AND ABS(rel_change_pct) >= ?")
        params.append(min_change_pct)

    where_sql = " AND ".join(where_clauses)

    # sort: time series if product_id else movers
    if product_id is not None:
        order_by = "month ASC"
    else:
        order_by = "rel_change_pct DESC"
        if direction == "down":
            order_by = "rel_change_pct ASC"

    count_query = base_cte + f"""
        SELECT COUNT(*) AS total
        FROM mom
        WHERE prev_avg_price IS NOT NULL
          AND {where_sql}
    """
    total = fetch_all(count_query, tuple(params))[0]["total"]

    data_query = base_cte + f"""
        SELECT
            product_id,
            product_name,
            month,
            prev_month,
            avg_realistic_price,
            prev_avg_price,
            abs_change,
            rel_change_pct,
            num_points
        FROM mom
        WHERE prev_avg_price IS NOT NULL
          AND {where_sql}
        ORDER BY {order_by}
        LIMIT ? OFFSET ?
    """
    rows = fetch_all(data_query, tuple(params + [limit, offset]))

    return PaginatedMonthlyMoM(
        total=total,
        limit=limit,
        offset=offset,
        items=rows,
    )


# -------------------------
# /summary (SQLite)
# -------------------------
@router.get("/summary", response_model=SummaryStats)
def get_summary():
    """
    Liefert zusammengefasste Kennzahlen für Dashboard/Übersicht.
    SQLite-only.
    """
    query = """
        WITH last_crawl AS (
            SELECT id, crawl_timestamp
            FROM crawls
            ORDER BY crawl_timestamp DESC
            LIMIT 1
        )
        SELECT
            (SELECT COUNT(*) FROM products) AS total_products,
            (SELECT COUNT(*) FROM crawls) AS total_crawls,
            (SELECT crawl_timestamp FROM last_crawl) AS last_crawl_at,
            (SELECT COUNT(*) FROM product_stats) AS total_product_stats_rows,
            (SELECT COUNT(*) FROM product_stats WHERE realistic_price IS NOT NULL)
                AS product_stats_with_realistic_price,
            COALESCE((
                SELECT COUNT(DISTINCT ps.product_id)
                FROM product_stats ps
                JOIN last_crawl lc ON ps.crawl_id = lc.id
            ), 0) AS products_in_last_crawl,
            COALESCE((
                SELECT COUNT(*)
                FROM offers o
                JOIN last_crawl lc ON o.crawl_id = lc.id
            ), 0) AS offers_in_last_crawl
        ;
    """
    row = fetch_all(query)[0]

    return SummaryStats(
        total_products=row["total_products"],
        total_crawls=row["total_crawls"],
        last_crawl_at=row["last_crawl_at"],
        total_product_stats_rows=row["total_product_stats_rows"],
        product_stats_with_realistic_price=row["product_stats_with_realistic_price"],
        products_in_last_crawl=row["products_in_last_crawl"],
        offers_in_last_crawl=row["offers_in_last_crawl"],
    )


# -------------------------
# /volatility (SQLite)
# -------------------------
@router.get("/volatility", response_model=PaginatedVolatility)
def get_volatility(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None, description="Filter nach Produktname (LIKE)"),
):
    """
    Volatilitäts-Ranking: Produkte mit den größten Preisschwankungen.
    Sortiert nach Variationskoeffizient (CV = stddev/avg*100) absteigend.
    Nur Produkte mit >= 3 Crawls.
    """
    base_cte = """
    WITH stats AS (
      SELECT
        ps.product_id,
        p.name AS product_name,
        COUNT(ps.id) AS crawl_count,
        AVG(ps.realistic_price) AS avg_realistic_price,
        MIN(ps.realistic_price) AS min_price,
        MAX(ps.realistic_price) AS max_price,
        MAX(ps.realistic_price) - MIN(ps.realistic_price) AS price_range,
        SQRT(
          CASE
            WHEN AVG(ps.realistic_price * ps.realistic_price)
                 - (AVG(ps.realistic_price) * AVG(ps.realistic_price)) < 0
            THEN 0.0
            ELSE AVG(ps.realistic_price * ps.realistic_price)
                 - (AVG(ps.realistic_price) * AVG(ps.realistic_price))
          END
        ) AS stddev_price
      FROM product_stats ps
      JOIN products p ON p.id = ps.product_id
      WHERE ps.realistic_price IS NOT NULL
      GROUP BY ps.product_id, p.name
      HAVING COUNT(ps.id) >= 3
    ),
    with_cv AS (
      SELECT
        product_id,
        product_name,
        crawl_count,
        avg_realistic_price,
        stddev_price,
        CASE
          WHEN avg_realistic_price = 0 THEN 0.0
          ELSE (stddev_price / avg_realistic_price) * 100.0
        END AS cv,
        min_price,
        max_price,
        price_range
      FROM stats
    )
    """

    where_clauses = ["1=1"]
    params: list = []

    if search:
        where_clauses.append("LOWER(product_name) LIKE '%' || LOWER(?) || '%'")
        params.append(search)

    where_sql = " AND ".join(where_clauses)

    count_query = base_cte + f"""
        SELECT COUNT(*) AS total FROM with_cv WHERE {where_sql}
    """
    total = fetch_all(count_query, tuple(params))[0]["total"]

    data_query = base_cte + f"""
        SELECT product_id, product_name, avg_realistic_price, stddev_price,
               cv, min_price, max_price, price_range, crawl_count
        FROM with_cv
        WHERE {where_sql}
        ORDER BY cv DESC
        LIMIT ? OFFSET ?
    """
    rows = fetch_all(data_query, tuple(params + [limit, offset]))

    return PaginatedVolatility(total=total, limit=limit, offset=offset, items=rows)


# -------------------------
# /set-summary (SQLite)
# -------------------------
@router.get("/set-summary", response_model=SetSummaryResponse)
def get_set_summary():
    """
    Preisübersicht aggregiert nach Set (nur letzter Crawl pro Produkt).
    Sortiert nach avg_realistic_price DESC.
    """
    query = """
    WITH latest AS (
      SELECT
        ps.product_id,
        ps.realistic_price,
        ps.available_items,
        ROW_NUMBER() OVER (
          PARTITION BY ps.product_id
          ORDER BY c.crawl_timestamp DESC
        ) AS rn
      FROM product_stats ps
      JOIN crawls c ON c.id = ps.crawl_id
      WHERE ps.realistic_price IS NOT NULL
    ),
    latest_only AS (
      SELECT product_id, realistic_price, available_items
      FROM latest WHERE rn = 1
    )
    SELECT
      p.set_name,
      COUNT(*) AS product_count,
      AVG(lo.realistic_price) AS avg_realistic_price,
      SUM(lo.available_items) AS total_available_items,
      MIN(lo.realistic_price) AS min_price,
      MAX(lo.realistic_price) AS max_price
    FROM latest_only lo
    JOIN products p ON p.id = lo.product_id
    GROUP BY p.set_name
    ORDER BY avg_realistic_price DESC
    """
    rows = fetch_all(query)
    return SetSummaryResponse(items=rows)


# -------------------------
# /percentile-position/{product_id} (SQLite)
# -------------------------
@router.get("/percentile-position/{product_id}", response_model=PercentilePosition)
def get_percentile_position(product_id: int):
    """
    Zeigt wie der aktuelle Preis im Vergleich zur kompletten historischen
    Preisspanne einzuordnen ist (0 = historisches Tief, 100 = historisches Hoch).
    """
    query = """
    WITH history AS (
      SELECT
        ps.realistic_price,
        ROW_NUMBER() OVER (ORDER BY c.crawl_timestamp DESC) AS rn
      FROM product_stats ps
      JOIN crawls c ON c.id = ps.crawl_id
      WHERE ps.product_id = ?
        AND ps.realistic_price IS NOT NULL
    ),
    agg AS (
      SELECT
        COUNT(*) AS crawl_count,
        MIN(realistic_price) AS historical_min,
        MAX(realistic_price) AS historical_max,
        AVG(realistic_price) AS historical_avg,
        (SELECT realistic_price FROM history WHERE rn = 1) AS current_price
      FROM history
    )
    SELECT
      (SELECT name FROM products WHERE id = ?) AS product_name,
      crawl_count,
      historical_min,
      historical_max,
      historical_avg,
      current_price,
      CASE
        WHEN historical_max = historical_min THEN 50.0
        ELSE ((current_price - historical_min) / (historical_max - historical_min)) * 100.0
      END AS percentile_position
    FROM agg
    """
    rows = fetch_all(query, (product_id, product_id))
    if not rows or rows[0]["crawl_count"] == 0 or rows[0]["current_price"] is None:
        raise HTTPException(status_code=404, detail="Keine historischen Daten für dieses Produkt.")
    row = rows[0]
    return PercentilePosition(
        product_id=product_id,
        product_name=row["product_name"],
        current_price=row["current_price"],
        historical_min=row["historical_min"],
        historical_max=row["historical_max"],
        historical_avg=row["historical_avg"],
        percentile_position=row["percentile_position"],
        crawl_count=row["crawl_count"],
    )


# -------------------------
# /offer-distribution/{product_id} (SQLite)
# -------------------------
@router.get("/offer-distribution/{product_id}", response_model=OfferDistribution)
def get_offer_distribution(product_id: int):
    """
    Preisverteilung der Angebote im letzten Crawl für ein Produkt.
    Liefert Min/Max/Median/P25/P75/Avg + Zustand-Breakdown aus dem comment-Feld.
    """
    # --- Aggregate stats ---
    agg_query = """
    WITH latest_crawl AS (
      SELECT o.crawl_id, c.crawl_timestamp, c.id AS cid
      FROM offers o
      JOIN crawls c ON c.id = o.crawl_id
      WHERE o.product_id = ?
      ORDER BY c.crawl_timestamp DESC
      LIMIT 1
    ),
    base AS (
      SELECT o.seller, o.item_price, o.qty
      FROM offers o
      JOIN latest_crawl lc ON o.crawl_id = lc.cid
      WHERE o.product_id = ? AND o.item_price IS NOT NULL
    ),
    ordered AS (
      SELECT
        item_price,
        ROW_NUMBER() OVER (ORDER BY item_price) AS rn,
        COUNT(*) OVER () AS total_rows
      FROM base
    )
    SELECT
      (SELECT crawl_id FROM latest_crawl) AS crawl_id,
      (SELECT crawl_timestamp FROM latest_crawl) AS crawled_at,
      (SELECT name FROM products WHERE id = ?) AS product_name,
      (SELECT COUNT(DISTINCT seller) FROM base) AS seller_count,
      (SELECT COALESCE(SUM(qty), 0) FROM base) AS total_qty,
      (SELECT COUNT(*) FROM base) AS offer_count,
      (SELECT MIN(item_price) FROM base) AS min_price,
      (SELECT MAX(item_price) FROM base) AS max_price,
      (SELECT AVG(item_price) FROM base) AS avg_price,
      AVG(CASE WHEN rn IN ((total_rows + 1) / 2, (total_rows + 2) / 2) THEN item_price END) AS median_price,
      AVG(CASE WHEN rn IN ((total_rows + 3) / 4, (total_rows + 4) / 4) THEN item_price END) AS p25_price,
      AVG(CASE WHEN rn IN (
        (3 * total_rows + 1) / 4, (3 * total_rows + 2) / 4,
        (3 * total_rows + 3) / 4, (3 * total_rows + 4) / 4
      ) THEN item_price END) AS p75_price
    FROM ordered
    """
    agg_rows = fetch_all(agg_query, (product_id, product_id, product_id))
    if not agg_rows or agg_rows[0]["offer_count"] == 0:
        raise HTTPException(status_code=404, detail="Keine Angebote für dieses Produkt im letzten Crawl.")
    agg = agg_rows[0]

    # --- Condition breakdown ---
    cond_query = """
    WITH latest_crawl AS (
      SELECT c.id AS cid
      FROM offers o
      JOIN crawls c ON c.id = o.crawl_id
      WHERE o.product_id = ?
      ORDER BY c.crawl_timestamp DESC
      LIMIT 1
    ),
    base AS (
      SELECT o.item_price, o.comment
      FROM offers o
      JOIN latest_crawl lc ON o.crawl_id = lc.cid
      WHERE o.product_id = ? AND o.item_price IS NOT NULL
    ),
    classified AS (
      SELECT
        item_price,
        CASE
          WHEN UPPER(COALESCE(comment,'')) LIKE '%SEALED%'
            OR UPPER(COALESCE(comment,'')) LIKE '%OVP%'
            THEN 'Sealed/OVP'
          WHEN UPPER(COALESCE(comment,'')) LIKE '%NEAR MINT%'
            OR UPPER(COALESCE(comment,'')) LIKE '% NM%'
            OR UPPER(COALESCE(comment,'')) LIKE 'NM %'
            OR UPPER(COALESCE(comment,'')) = 'NM'
            THEN 'NM'
          WHEN UPPER(COALESCE(comment,'')) LIKE '%LIGHTLY PLAYED%'
            OR UPPER(COALESCE(comment,'')) LIKE '% LP%'
            OR UPPER(COALESCE(comment,'')) LIKE 'LP %'
            OR UPPER(COALESCE(comment,'')) = 'LP'
            THEN 'LP'
          WHEN UPPER(COALESCE(comment,'')) LIKE '%MODERATELY PLAYED%'
            OR UPPER(COALESCE(comment,'')) LIKE '% PL%'
            OR UPPER(COALESCE(comment,'')) LIKE 'PL %'
            OR UPPER(COALESCE(comment,'')) = 'PL'
            THEN 'PL'
          WHEN UPPER(COALESCE(comment,'')) LIKE '%HEAVILY PLAYED%'
            OR UPPER(COALESCE(comment,'')) LIKE '% HP%'
            OR UPPER(COALESCE(comment,'')) LIKE 'HP %'
            OR UPPER(COALESCE(comment,'')) = 'HP'
            THEN 'HP'
          WHEN UPPER(COALESCE(comment,'')) LIKE '%DAMAGED%'
            OR UPPER(COALESCE(comment,'')) LIKE '%POOR%'
            THEN 'Damaged'
          ELSE 'Unknown'
        END AS condition
      FROM base
    )
    SELECT condition, COUNT(*) AS count,
           MIN(item_price) AS min_price,
           MAX(item_price) AS max_price,
           AVG(item_price) AS avg_price
    FROM classified
    GROUP BY condition
    ORDER BY count DESC
    """
    cond_rows = fetch_all(cond_query, (product_id, product_id))
    conditions = [ConditionBreakdown(**r) for r in cond_rows]

    return OfferDistribution(
        product_id=product_id,
        product_name=agg["product_name"],
        crawl_id=agg["crawl_id"],
        crawled_at=agg["crawled_at"],
        seller_count=agg["seller_count"],
        total_qty=agg["total_qty"],
        offer_count=agg["offer_count"],
        min_price=agg["min_price"],
        max_price=agg["max_price"],
        median_price=agg["median_price"] or agg["avg_price"],
        p25_price=agg["p25_price"] or agg["min_price"],
        p75_price=agg["p75_price"] or agg["max_price"],
        avg_price=agg["avg_price"],
        conditions=conditions,
    )


# -------------------------
# /value-ratios (SQLite)
# -------------------------
VALUE_RATIO_SORT_COLUMNS = {
    "product_name": "product_name",
    "sealed_price":  "sealed_price",
    "singles_sum":   "singles_sum",
    "value_ratio":   "value_ratio",
}


@router.get("/value-ratios", response_model=PaginatedValueRatios)
def get_value_ratios(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None, description="Filter nach Produktname (LIKE)"),
    sort_by: str = Query("value_ratio", description="Spalte für Sortierung"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
):
    """
    Vergleich: Sealed-Preis vs. Summe der Einzelpreise aller verlinkten Komponenten.
    value_ratio = singles_sum / sealed_price.
    Nur Produkte mit mind. einer Komponente mit bekanntem Preis werden angezeigt.
    """
    base_cte = """
    WITH latest_prices AS (
        SELECT
            ps.product_id,
            ps.realistic_price,
            ROW_NUMBER() OVER (
                PARTITION BY ps.product_id
                ORDER BY c.crawl_timestamp DESC
            ) AS rn
        FROM product_stats ps
        JOIN crawls c ON c.id = ps.crawl_id
        WHERE ps.realistic_price IS NOT NULL
    ),
    lp AS (
        SELECT product_id, realistic_price FROM latest_prices WHERE rn = 1
    ),
    component_sums AS (
        SELECT
            sc.product_id AS sealed_id,
            SUM(lp2.realistic_price * sc.qty) AS singles_sum,
            COUNT(*) AS priced_components
        FROM sealed_contents sc
        JOIN lp lp2 ON lp2.product_id = sc.linked_product_id
        GROUP BY sc.product_id
    )
    """

    where_clauses = ["1=1"]
    params: list = []

    if search:
        where_clauses.append("LOWER(p.name) LIKE '%' || LOWER(?) || '%'")
        params.append(search)

    where_sql = " AND ".join(where_clauses)

    count_query = base_cte + f"""
        SELECT COUNT(*) AS total
        FROM products p
        JOIN component_sums cs ON cs.sealed_id = p.id
        JOIN lp ON lp.product_id = p.id
        WHERE {where_sql}
    """
    total = fetch_all(count_query, tuple(params))[0]["total"]

    col = VALUE_RATIO_SORT_COLUMNS.get(sort_by, "value_ratio")
    direction = "DESC" if sort_order == "desc" else "ASC"
    order_sql = f"CASE WHEN {col} IS NULL THEN 1 ELSE 0 END, {col} {direction}"

    data_query = base_cte + f"""
        SELECT
            p.id AS product_id,
            p.name AS product_name,
            lp.realistic_price AS sealed_price,
            cs.singles_sum,
            ROUND(CAST(cs.singles_sum / lp.realistic_price AS NUMERIC), 4) AS value_ratio,
            cs.priced_components
        FROM products p
        JOIN component_sums cs ON cs.sealed_id = p.id
        JOIN lp ON lp.product_id = p.id
        WHERE {where_sql}
        ORDER BY {order_sql}
        LIMIT ? OFFSET ?
    """
    rows = fetch_all(data_query, tuple(params + [limit, offset]))

    return PaginatedValueRatios(total=total, limit=limit, offset=offset, items=rows)

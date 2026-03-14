"""Initial schema — all tables

Revision ID: 0001
Revises:
Create Date: 2026-03-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------
    # products (ORM-verwaltet)
    # -------------------------
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("cardmarket_url", sa.String(), nullable=False),
        sa.Column("game", sa.String(), nullable=True, server_default="pokemon"),
        sa.Column("language", sa.String(), nullable=True, server_default="de"),
        sa.Column("set_name", sa.String(), nullable=True),
        sa.Column("release_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cardmarket_url"),
    )
    op.create_index("ix_products_id", "products", ["id"], unique=False)
    op.create_index("ix_products_name", "products", ["name"], unique=False)
    op.create_index("ix_products_cardmarket_url", "products", ["cardmarket_url"], unique=True)

    # -------------------------
    # crawls
    # -------------------------
    op.create_table(
        "crawls",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("crawl_timestamp", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("crawl_timestamp"),
    )

    # -------------------------
    # product_stats
    # -------------------------
    op.create_table(
        "product_stats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("crawl_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("available_items", sa.Integer(), nullable=True),
        sa.Column("from_price", sa.Float(), nullable=True),
        sa.Column("price_trend", sa.Float(), nullable=True),
        sa.Column("avg_30d", sa.Float(), nullable=True),
        sa.Column("avg_7d", sa.Float(), nullable=True),
        sa.Column("avg_1d", sa.Float(), nullable=True),
        sa.Column("realistic_price", sa.Float(), nullable=True),
        sa.Column("offers_used", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["crawl_id"], ["crawls.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("crawl_id", "product_id"),
    )

    # -------------------------
    # offers
    # -------------------------
    op.create_table(
        "offers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("crawl_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("seller", sa.Text(), nullable=True),
        sa.Column("ratings", sa.Integer(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("item_price", sa.Float(), nullable=True),
        sa.Column("shipping_price", sa.Float(), nullable=True),
        sa.Column("total_price", sa.Float(), nullable=True),
        sa.Column("qty", sa.Integer(), nullable=True),
        sa.Column("price_text", sa.Text(), nullable=True),
        sa.Column("raw_cells", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["crawl_id"], ["crawls.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # -------------------------
    # sealed_contents
    # -------------------------
    op.create_table(
        "sealed_contents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
        sa.Column("component_type", sa.Text(), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False),
        sa.Column("linked_product_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["linked_product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "component_type"),
    )


def downgrade() -> None:
    op.drop_table("sealed_contents")
    op.drop_table("offers")
    op.drop_table("product_stats")
    op.drop_table("crawls")
    op.drop_index("ix_products_cardmarket_url", table_name="products")
    op.drop_index("ix_products_name", table_name="products")
    op.drop_index("ix_products_id", table_name="products")
    op.drop_table("products")

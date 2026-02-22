"""unknown_terms table

Revision ID: 0004_unknown_terms
Revises: 0003_keywords_and_resume_profiles
Create Date: 2026-02-21
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_unknown_terms"
down_revision = "0003_keywords_and_resume_profiles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "unknown_terms",
        sa.Column("term", sa.String(length=255), primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("unknown_terms")


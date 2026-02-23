"""add_job_favorites_table

Revision ID: df52329900aa
Revises: 0004_unknown_terms
Create Date: 2026-02-21
"""

from alembic import op
import sqlalchemy as sa


revision = "df52329900aa"
down_revision = "0004_unknown_terms"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_favorites",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("job_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.UniqueConstraint("user_id", "job_id", name="uq_job_favorites_user_job"),
    )
    op.create_index("ix_job_favorites_user_id", "job_favorites", ["user_id"], unique=False)
    op.create_index("ix_job_favorites_job_id", "job_favorites", ["job_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_job_favorites_job_id", table_name="job_favorites")
    op.drop_index("ix_job_favorites_user_id", table_name="job_favorites")
    op.drop_table("job_favorites")

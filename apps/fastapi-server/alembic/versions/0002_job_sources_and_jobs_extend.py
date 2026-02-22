"""job_sources + extend jobs for ingest/search

Revision ID: 0002_job_sources_and_jobs_extend
Revises: 0001_init
Create Date: 2026-02-20
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_job_sources_and_jobs_extend"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_sources",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("type", sa.String(length=30), nullable=False),
        sa.Column("company_name", sa.String(length=255), nullable=True),
        sa.Column("base_key", sa.String(length=255), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fetch_interval_minutes", sa.Integer(), nullable=False, server_default=sa.text("360")),
        sa.Column("max_items", sa.Integer(), nullable=False, server_default=sa.text("500")),
        sa.Column("last_run_at", sa.DateTime(), nullable=True),
        sa.Column("last_success_at", sa.DateTime(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_job_sources_type", "job_sources", ["type"], unique=False)
    op.create_index("ix_job_sources_base_key", "job_sources", ["base_key"], unique=False)

    # Extend `jobs` for Simplify-style ingest/search. Keep nullable to avoid breaking existing rows.
    op.add_column("jobs", sa.Column("apply_url", sa.String(length=1024), nullable=True))
    op.add_column("jobs", sa.Column("posted_at", sa.DateTime(), nullable=True))
    op.add_column("jobs", sa.Column("last_seen_at", sa.DateTime(), nullable=True))
    op.add_column("jobs", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("jobs", sa.Column("raw_json", sa.Text(), nullable=True))

    op.create_index("ix_jobs_is_active", "jobs", ["is_active"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_jobs_is_active", table_name="jobs")

    op.drop_column("jobs", "raw_json")
    op.drop_column("jobs", "is_active")
    op.drop_column("jobs", "last_seen_at")
    op.drop_column("jobs", "posted_at")
    op.drop_column("jobs", "apply_url")

    op.drop_index("ix_job_sources_base_key", table_name="job_sources")
    op.drop_index("ix_job_sources_type", table_name="job_sources")
    op.drop_table("job_sources")


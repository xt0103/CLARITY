"""add_company_logo_url_to_jobs

Revision ID: b75fc9942453
Revises: 08f70cad3dad
Create Date: 2026-03-07 15:31:51.292265

"""
from alembic import op
import sqlalchemy as sa



revision = 'b75fc9942453'
down_revision = '08f70cad3dad'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("company_logo_url", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "company_logo_url")


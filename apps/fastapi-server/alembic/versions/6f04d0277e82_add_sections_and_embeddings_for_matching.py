"""add_sections_and_embeddings_for_matching

Revision ID: 6f04d0277e82
Revises: b75fc9942453
Create Date: 2026-03-07 17:04:58.856520

"""
from alembic import op
import sqlalchemy as sa



revision = '6f04d0277e82'
down_revision = 'b75fc9942453'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add sections and embeddings fields to jobs table
    op.add_column("jobs", sa.Column("jd_sections_json", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("jd_sections_conf_json", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("jd_section_keywords_json", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("jd_embeddings_json", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("jd_sections_updated_at", sa.DateTime(), nullable=True))
    
    # Add sections and embeddings fields to resume_profiles table
    op.add_column("resume_profiles", sa.Column("cv_sections_json", sa.Text(), nullable=True))
    op.add_column("resume_profiles", sa.Column("cv_sections_conf_json", sa.Text(), nullable=True))
    op.add_column("resume_profiles", sa.Column("cv_embeddings_json", sa.Text(), nullable=True))
    op.add_column("resume_profiles", sa.Column("cv_sections_updated_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    # Remove fields from resume_profiles
    op.drop_column("resume_profiles", "cv_sections_updated_at")
    op.drop_column("resume_profiles", "cv_embeddings_json")
    op.drop_column("resume_profiles", "cv_sections_conf_json")
    op.drop_column("resume_profiles", "cv_sections_json")
    
    # Remove fields from jobs
    op.drop_column("jobs", "jd_sections_updated_at")
    op.drop_column("jobs", "jd_embeddings_json")
    op.drop_column("jobs", "jd_section_keywords_json")
    op.drop_column("jobs", "jd_sections_conf_json")
    op.drop_column("jobs", "jd_sections_json")


"""keywords + resume_profiles

Revision ID: 0003_keywords_and_resume_profiles
Revises: 0002_job_sources_and_jobs_extend
Create Date: 2026-02-21
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_keywords_and_resume_profiles"
down_revision = "0002_job_sources_and_jobs_extend"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend `jobs` with keyword cache fields (TEXT JSON for SQLite compatibility)
    op.add_column("jobs", sa.Column("job_keywords_json", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("job_keywords_updated_at", sa.DateTime(), nullable=True))

    # Resume profiles cache: parsed text + keywords per resume, per user.
    op.create_table(
        "resume_profiles",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("resume_id", sa.String(length=36), nullable=False),
        sa.Column("parsed_text", sa.Text(), nullable=True),
        sa.Column("keywords_json", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["resume_id"], ["resumes.id"]),
        sa.UniqueConstraint("resume_id", name="uq_resume_profiles_resume_id"),
    )
    op.create_index("ix_resume_profiles_user_id", "resume_profiles", ["user_id"], unique=False)
    op.create_index("ix_resume_profiles_resume_id", "resume_profiles", ["resume_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_resume_profiles_resume_id", table_name="resume_profiles")
    op.drop_index("ix_resume_profiles_user_id", table_name="resume_profiles")
    op.drop_table("resume_profiles")

    op.drop_column("jobs", "job_keywords_updated_at")
    op.drop_column("jobs", "job_keywords_json")


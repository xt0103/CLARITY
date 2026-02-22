"""init tables

Revision ID: 0001_init
Revises: 
Create Date: 2026-02-14

"""

from alembic import op
import sqlalchemy as sa


revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("default_resume_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "resumes",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("text_content", sa.Text(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_resumes_user_id", "resumes", ["user_id"], unique=False)
    op.create_index("ix_resumes_is_deleted", "resumes", ["is_deleted"], unique=False)

    op.create_table(
        "jobs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("company", sa.String(length=255), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("job_type", sa.String(length=80), nullable=True),
        sa.Column("tags_json", sa.JSON(), nullable=True),
        sa.Column("description_text", sa.Text(), nullable=False),
        sa.Column("external_url", sa.String(length=1024), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("source_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("source", "source_id", name="uq_jobs_source_source_id"),
    )
    op.create_index("ix_jobs_title", "jobs", ["title"], unique=False)
    op.create_index("ix_jobs_company", "jobs", ["company"], unique=False)
    op.create_index("ix_jobs_source", "jobs", ["source"], unique=False)

    op.create_table(
        "applications",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("job_id", sa.String(length=36), nullable=True),
        sa.Column("snapshot_title", sa.String(length=255), nullable=False),
        sa.Column("snapshot_company", sa.String(length=255), nullable=False),
        sa.Column("snapshot_location", sa.String(length=255), nullable=True),
        sa.Column("snapshot_external_url", sa.String(length=1024), nullable=True),
        sa.Column("platform_source", sa.String(length=20), nullable=False),
        sa.Column("date_applied", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
    )
    op.create_index("ix_applications_user_id", "applications", ["user_id"], unique=False)
    op.create_index("ix_applications_status", "applications", ["status"], unique=False)
    op.create_index("ix_applications_is_deleted", "applications", ["is_deleted"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_applications_is_deleted", table_name="applications")
    op.drop_index("ix_applications_status", table_name="applications")
    op.drop_index("ix_applications_user_id", table_name="applications")
    op.drop_table("applications")

    op.drop_index("ix_jobs_source", table_name="jobs")
    op.drop_index("ix_jobs_company", table_name="jobs")
    op.drop_index("ix_jobs_title", table_name="jobs")
    op.drop_table("jobs")

    op.drop_index("ix_resumes_is_deleted", table_name="resumes")
    op.drop_index("ix_resumes_user_id", table_name="resumes")
    op.drop_table("resumes")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")


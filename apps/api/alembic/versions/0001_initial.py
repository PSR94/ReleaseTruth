"""Initial ReleaseTruth persistence schema.

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("repository_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_projects_slug", "projects", ["slug"], unique=True)

    op.create_table(
        "snapshots",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("release", sa.String(length=200), nullable=True),
        sa.Column("fingerprint", sa.String(length=128), nullable=False),
        sa.Column("behavior_lock", sa.JSON(), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "fingerprint", name="uq_snapshot_project_fingerprint"),
    )
    op.create_index("ix_snapshots_fingerprint", "snapshots", ["fingerprint"])
    op.create_index("ix_snapshots_project_id", "snapshots", ["project_id"])

    op.create_table(
        "runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("base_snapshot_id", sa.String(length=36), nullable=False),
        sa.Column("candidate_snapshot_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("compatibility_score", sa.Float(), nullable=False),
        sa.Column("git_sha", sa.String(length=64), nullable=True),
        sa.Column("pull_request", sa.Integer(), nullable=True),
        sa.Column("summary", sa.JSON(), nullable=False),
        sa.Column("report", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["base_snapshot_id"], ["snapshots.id"]),
        sa.ForeignKeyConstraint(["candidate_snapshot_id"], ["snapshots.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_runs_base_snapshot_id", "runs", ["base_snapshot_id"])
    op.create_index("ix_runs_candidate_snapshot_id", "runs", ["candidate_snapshot_id"])
    op.create_index("ix_runs_git_sha", "runs", ["git_sha"])
    op.create_index("ix_runs_project_id", "runs", ["project_id"])

    op.create_table(
        "changes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("change_id", sa.String(length=80), nullable=False),
        sa.Column("surface", sa.String(length=40), nullable=False),
        sa.Column("observation_id", sa.String(length=240), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("before", sa.JSON(), nullable=True),
        sa.Column("after", sa.JSON(), nullable=True),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_changes_change_id", "changes", ["change_id"])
    op.create_index("ix_changes_run_id", "changes", ["run_id"])
    op.create_index("ix_changes_severity", "changes", ["severity"])
    op.create_index("ix_changes_surface", "changes", ["surface"])

    op.create_table(
        "baselines",
        sa.Column("project_id", sa.String(length=36), nullable=False),
        sa.Column("snapshot_id", sa.String(length=36), nullable=False),
        sa.Column("set_by", sa.String(length=200), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["snapshot_id"], ["snapshots.id"]),
        sa.PrimaryKeyConstraint("project_id"),
    )

    op.create_table(
        "github_deliveries",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("delivery_id", sa.String(length=120), nullable=True),
        sa.Column("event", sa.String(length=120), nullable=False),
        sa.Column("action", sa.String(length=120), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("delivery_id"),
    )
    op.create_index("ix_github_deliveries_delivery_id", "github_deliveries", ["delivery_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_github_deliveries_delivery_id", table_name="github_deliveries")
    op.drop_table("github_deliveries")
    op.drop_table("baselines")
    op.drop_index("ix_changes_surface", table_name="changes")
    op.drop_index("ix_changes_severity", table_name="changes")
    op.drop_index("ix_changes_run_id", table_name="changes")
    op.drop_index("ix_changes_change_id", table_name="changes")
    op.drop_table("changes")
    op.drop_index("ix_runs_project_id", table_name="runs")
    op.drop_index("ix_runs_git_sha", table_name="runs")
    op.drop_index("ix_runs_candidate_snapshot_id", table_name="runs")
    op.drop_index("ix_runs_base_snapshot_id", table_name="runs")
    op.drop_table("runs")
    op.drop_index("ix_snapshots_project_id", table_name="snapshots")
    op.drop_index("ix_snapshots_fingerprint", table_name="snapshots")
    op.drop_table("snapshots")
    op.drop_index("ix_projects_slug", table_name="projects")
    op.drop_table("projects")

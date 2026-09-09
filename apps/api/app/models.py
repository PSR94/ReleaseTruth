from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def new_id() -> str:
    return str(uuid4())


def now() -> datetime:
    return datetime.now(UTC)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    repository_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, nullable=False)

    snapshots: Mapped[list["Snapshot"]] = relationship(back_populates="project")
    runs: Mapped[list["Run"]] = relationship(back_populates="project")


class Snapshot(Base):
    __tablename__ = "snapshots"
    __table_args__ = (UniqueConstraint("project_id", "fingerprint", name="uq_snapshot_project_fingerprint"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    release: Mapped[str | None] = mapped_column(String(200))
    fingerprint: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    behavior_lock: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, nullable=False)

    project: Mapped[Project] = relationship(back_populates="snapshots")


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    base_snapshot_id: Mapped[str] = mapped_column(ForeignKey("snapshots.id"), index=True)
    candidate_snapshot_id: Mapped[str] = mapped_column(ForeignKey("snapshots.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="completed")
    compatibility_score: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    git_sha: Mapped[str | None] = mapped_column(String(64), index=True)
    pull_request: Mapped[int | None] = mapped_column(Integer)
    summary: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    report: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, nullable=False)

    project: Mapped[Project] = relationship(back_populates="runs")
    changes: Mapped[list["Change"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class Change(Base):
    __tablename__ = "changes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    change_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    surface: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    observation_id: Mapped[str] = mapped_column(String(240), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    before: Mapped[Any | None] = mapped_column(JSON)
    after: Mapped[Any | None] = mapped_column(JSON)
    evidence: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    run: Mapped[Run] = relationship(back_populates="changes")


class Baseline(Base):
    __tablename__ = "baselines"

    project_id: Mapped[str] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    snapshot_id: Mapped[str] = mapped_column(ForeignKey("snapshots.id"), nullable=False)
    set_by: Mapped[str | None] = mapped_column(String(200))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, nullable=False)


class GitHubDelivery(Base):
    __tablename__ = "github_deliveries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    delivery_id: Mapped[str | None] = mapped_column(String(120), unique=True, index=True)
    event: Mapped[str] = mapped_column(String(120), nullable=False)
    action: Mapped[str | None] = mapped_column(String(120))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, nullable=False)

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,118}[a-z0-9]$|^[a-z0-9]$")
    repository_url: str | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    repository_url: str | None
    created_at: datetime


class SnapshotIn(BaseModel):
    project_id: str
    behavior_lock: dict[str, Any]


class SnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    release: str | None
    fingerprint: str
    captured_at: datetime | None
    created_at: datetime


class RunIngest(BaseModel):
    project_id: str
    base_lock: dict[str, Any]
    candidate_lock: dict[str, Any]
    report: dict[str, Any]
    git_sha: str | None = None
    pull_request: int | None = None


class ChangeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    change_id: str
    surface: str
    observation_id: str
    path: str
    severity: str
    reason: str
    before: Any | None
    after: Any | None
    evidence: list[str]


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    base_snapshot_id: str
    candidate_snapshot_id: str
    status: str
    compatibility_score: float
    git_sha: str | None
    pull_request: int | None
    summary: dict[str, Any]
    created_at: datetime


class RunDetail(RunOut):
    report: dict[str, Any]
    changes: list[ChangeOut]


class BaselineSet(BaseModel):
    snapshot_id: str
    set_by: str | None = None


class BaselineOut(BaseModel):
    project_id: str
    snapshot_id: str
    set_by: str | None
    updated_at: datetime


class SummaryOut(BaseModel):
    projects: int
    snapshots: int
    runs: int
    breaking_changes: int
    significant_changes: int
    average_score: float

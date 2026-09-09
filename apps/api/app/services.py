from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Change, Project, Run, Snapshot


def require_project(db: Session, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    return project


def parse_captured_at(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def ensure_snapshot(db: Session, project_id: str, lock: dict[str, Any]) -> Snapshot:
    fingerprint = lock.get("fingerprint")
    if not isinstance(fingerprint, str) or not fingerprint:
        raise HTTPException(status_code=422, detail="behavior lock requires fingerprint")
    existing = db.scalar(
        select(Snapshot).where(
            Snapshot.project_id == project_id,
            Snapshot.fingerprint == fingerprint,
        )
    )
    if existing is not None:
        return existing
    snapshot = Snapshot(
        project_id=project_id,
        release=lock.get("release") if isinstance(lock.get("release"), str) else None,
        fingerprint=fingerprint,
        behavior_lock=lock,
        captured_at=parse_captured_at(lock.get("capturedAt")),
    )
    db.add(snapshot)
    db.flush()
    return snapshot


def report_parts(report: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    score = report.get("score") if isinstance(report.get("score"), dict) else {}
    comparison = report.get("comparison") if isinstance(report.get("comparison"), dict) else {}
    changes = comparison.get("changes") if isinstance(comparison.get("changes"), list) else []
    return score, comparison, [item for item in changes if isinstance(item, dict)]


def run_status(changes: list[dict[str, Any]]) -> str:
    severities = {str(change.get("severity", "minor")) for change in changes}
    if "breaking" in severities:
        return "breaking"
    if "significant" in severities:
        return "significant"
    if changes:
        return "changed"
    return "compatible"


def persist_run(
    db: Session,
    *,
    project_id: str,
    base: Snapshot,
    candidate: Snapshot,
    report: dict[str, Any],
    git_sha: str | None,
    pull_request: int | None,
) -> Run:
    score, _comparison, changes = report_parts(report)
    raw_score = score.get("score", 100.0)
    compatibility_score = float(raw_score) if isinstance(raw_score, (int, float)) else 100.0
    run = Run(
        project_id=project_id,
        base_snapshot_id=base.id,
        candidate_snapshot_id=candidate.id,
        status=run_status(changes),
        compatibility_score=compatibility_score,
        git_sha=git_sha,
        pull_request=pull_request,
        summary=score,
        report=report,
    )
    db.add(run)
    db.flush()
    for item in changes:
        db.add(
            Change(
                run_id=run.id,
                change_id=str(item.get("id", "unknown")),
                surface=str(item.get("surface", "unknown")),
                observation_id=str(item.get("observationId", "unknown")),
                path=str(item.get("path", "/")),
                severity=str(item.get("severity", "minor")),
                reason=str(item.get("classificationReason", "")),
                before=item.get("before"),
                after=item.get("after"),
                evidence=[str(value) for value in item.get("evidence", [])]
                if isinstance(item.get("evidence"), list)
                else [],
            )
        )
    db.flush()
    return run

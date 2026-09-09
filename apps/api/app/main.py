import hashlib
import hmac
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .config import get_settings
from .db import Base, engine, get_db
from .models import Baseline, Change, GitHubDelivery, Project, Run, Snapshot, now
from .schemas import (
    BaselineOut,
    BaselineSet,
    ProjectCreate,
    ProjectOut,
    RunDetail,
    RunIngest,
    RunOut,
    SnapshotIn,
    SnapshotOut,
    SummaryOut,
)
from .services import ensure_snapshot, persist_run, require_project

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # SQLite is the zero-setup local/demo mode. PostgreSQL deployments are migrated
    # explicitly with Alembic before the application process starts.
    if settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="ReleaseTruth API",
    version="0.1.0",
    description="Persistence, history, baseline and integration API for behavioral release evidence.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "releasetruth-api", "version": "0.1.0"}


@app.post("/v1/projects", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)) -> Project:
    project = Project(name=payload.name, slug=payload.slug, repository_url=payload.repository_url)
    db.add(project)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="project slug already exists") from exc
    db.refresh(project)
    return project


@app.get("/v1/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)) -> list[Project]:
    return list(db.scalars(select(Project).order_by(Project.created_at.desc())).all())


@app.get("/v1/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)) -> Project:
    return require_project(db, project_id)


@app.post("/v1/snapshots", response_model=SnapshotOut, status_code=201)
def create_snapshot(payload: SnapshotIn, db: Session = Depends(get_db)) -> Snapshot:
    require_project(db, payload.project_id)
    snapshot = ensure_snapshot(db, payload.project_id, payload.behavior_lock)
    db.commit()
    db.refresh(snapshot)
    return snapshot


@app.get("/v1/projects/{project_id}/snapshots", response_model=list[SnapshotOut])
def list_snapshots(project_id: str, db: Session = Depends(get_db)) -> list[Snapshot]:
    require_project(db, project_id)
    statement = (
        select(Snapshot)
        .where(Snapshot.project_id == project_id)
        .order_by(Snapshot.created_at.desc())
    )
    return list(db.scalars(statement).all())


@app.post("/v1/runs/ingest", response_model=RunDetail, status_code=201)
def ingest_run(payload: RunIngest, db: Session = Depends(get_db)) -> Run:
    require_project(db, payload.project_id)
    base = ensure_snapshot(db, payload.project_id, payload.base_lock)
    candidate = ensure_snapshot(db, payload.project_id, payload.candidate_lock)
    run = persist_run(
        db,
        project_id=payload.project_id,
        base=base,
        candidate=candidate,
        report=payload.report,
        git_sha=payload.git_sha,
        pull_request=payload.pull_request,
    )
    db.commit()
    statement = select(Run).options(selectinload(Run.changes)).where(Run.id == run.id)
    return db.scalar(statement)  # type: ignore[return-value]


@app.get("/v1/runs", response_model=list[RunOut])
def list_runs(project_id: str | None = None, limit: int = 50, db: Session = Depends(get_db)) -> list[Run]:
    limit = min(max(limit, 1), 200)
    statement = select(Run)
    if project_id:
        statement = statement.where(Run.project_id == project_id)
    statement = statement.order_by(Run.created_at.desc()).limit(limit)
    return list(db.scalars(statement).all())


@app.get("/v1/runs/{run_id}", response_model=RunDetail)
def get_run(run_id: str, db: Session = Depends(get_db)) -> Run:
    statement = select(Run).options(selectinload(Run.changes)).where(Run.id == run_id)
    run = db.scalar(statement)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    return run


@app.get("/v1/projects/{project_id}/history", response_model=list[RunOut])
def project_history(project_id: str, db: Session = Depends(get_db)) -> list[Run]:
    require_project(db, project_id)
    statement = (
        select(Run).where(Run.project_id == project_id).order_by(Run.created_at.desc()).limit(200)
    )
    return list(db.scalars(statement).all())


@app.put("/v1/projects/{project_id}/baseline", response_model=BaselineOut)
def set_baseline(project_id: str, payload: BaselineSet, db: Session = Depends(get_db)) -> Baseline:
    require_project(db, project_id)
    snapshot = db.get(Snapshot, payload.snapshot_id)
    if snapshot is None or snapshot.project_id != project_id:
        raise HTTPException(status_code=404, detail="snapshot not found for project")
    baseline = db.get(Baseline, project_id)
    if baseline is None:
        baseline = Baseline(project_id=project_id, snapshot_id=snapshot.id, set_by=payload.set_by)
        db.add(baseline)
    else:
        baseline.snapshot_id = snapshot.id
        baseline.set_by = payload.set_by
        baseline.updated_at = now()
    db.commit()
    db.refresh(baseline)
    return baseline


@app.get("/v1/projects/{project_id}/baseline", response_model=BaselineOut)
def get_baseline(project_id: str, db: Session = Depends(get_db)) -> Baseline:
    require_project(db, project_id)
    baseline = db.get(Baseline, project_id)
    if baseline is None:
        raise HTTPException(status_code=404, detail="baseline not set")
    return baseline


@app.get("/v1/summary", response_model=SummaryOut)
def summary(db: Session = Depends(get_db)) -> SummaryOut:
    projects = db.scalar(select(func.count()).select_from(Project)) or 0
    snapshots = db.scalar(select(func.count()).select_from(Snapshot)) or 0
    runs = db.scalar(select(func.count()).select_from(Run)) or 0
    breaking = db.scalar(select(func.count()).select_from(Change).where(Change.severity == "breaking")) or 0
    significant = db.scalar(
        select(func.count()).select_from(Change).where(Change.severity == "significant")
    ) or 0
    average = db.scalar(select(func.avg(Run.compatibility_score))) or 100.0
    return SummaryOut(
        projects=projects,
        snapshots=snapshots,
        runs=runs,
        breaking_changes=breaking,
        significant_changes=significant,
        average_score=round(float(average), 2),
    )


def verify_github_signature(body: bytes, signature: str | None) -> None:
    if not settings.github_webhook_enabled:
        raise HTTPException(status_code=404, detail="GitHub webhook ingestion is disabled")
    secret = settings.github_webhook_secret
    if not secret:
        if settings.github_webhook_allow_unsigned_dev:
            return
        raise HTTPException(status_code=503, detail="GitHub webhook secret is required when ingestion is enabled")
    if not signature or not signature.startswith("sha256="):
        raise HTTPException(status_code=401, detail="missing GitHub webhook signature")
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="invalid GitHub webhook signature")


@app.post("/v1/github/webhook", status_code=202)
async def github_webhook(
    request: Request,
    response: Response,
    x_github_event: str = Header(default="unknown"),
    x_github_delivery: str | None = Header(default=None),
    x_hub_signature_256: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    body = await request.body()
    verify_github_signature(body, x_hub_signature_256)
    try:
        payload = json.loads(body or b"{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="invalid JSON payload") from exc
    action = payload.get("action") if isinstance(payload, dict) else None
    delivery = GitHubDelivery(
        delivery_id=x_github_delivery,
        event=x_github_event,
        action=action if isinstance(action, str) else None,
        payload=payload if isinstance(payload, dict) else {"payload": payload},
    )
    db.add(delivery)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        response.status_code = 200
        return {"status": "duplicate"}
    return {"status": "accepted"}

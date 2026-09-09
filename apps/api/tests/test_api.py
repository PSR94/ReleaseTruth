import os

os.environ["RELEASETRUTH_DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def lock(release: str, fingerprint: str) -> dict:
    return {
        "schema": "https://releasetruth.dev/schema/behavior-lock/v1",
        "toolVersion": "0.1.0",
        "release": release,
        "capturedAt": "2026-09-09T00:00:00Z",
        "fingerprint": fingerprint,
        "surfaces": {
            "api": [],
            "browser": [],
            "accessibility": [],
            "cli": [],
            "events": [],
            "performance": [],
        },
        "evidence": [],
    }


def test_project_run_baseline_and_summary() -> None:
    with TestClient(app) as client:
        project = client.post(
            "/v1/projects", json={"name": "TruthShop", "slug": "truthshop"}
        ).json()
        report = {
            "score": {"score": 80.0, "countsBySeverity": {"breaking": 1}},
            "comparison": {
                "baseFingerprint": "sha256:base",
                "candidateFingerprint": "sha256:candidate",
                "changes": [
                    {
                        "id": "chg-1",
                        "surface": "api",
                        "observationId": "POST /orders",
                        "path": "/status",
                        "changeType": "value_changed",
                        "before": 400,
                        "after": 422,
                        "severity": "breaking",
                        "confidence": 1.0,
                        "evidence": ["http-1"],
                        "classificationReason": "HTTP status contract changed",
                    }
                ],
            },
        }
        run = client.post(
            "/v1/runs/ingest",
            json={
                "project_id": project["id"],
                "base_lock": lock("good", "sha256:base"),
                "candidate_lock": lock("regression", "sha256:candidate"),
                "report": report,
                "git_sha": "abc123",
            },
        )
        assert run.status_code == 201
        body = run.json()
        assert body["status"] == "breaking"
        assert body["changes"][0]["severity"] == "breaking"

        baseline = client.put(
            f"/v1/projects/{project['id']}/baseline",
            json={"snapshot_id": body["base_snapshot_id"], "set_by": "test"},
        )
        assert baseline.status_code == 200

        summary = client.get("/v1/summary").json()
        assert summary["projects"] == 1
        assert summary["runs"] == 1
        assert summary["breaking_changes"] == 1

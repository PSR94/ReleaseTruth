import hashlib
import hmac
import os

os.environ["RELEASETRUTH_DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from fastapi.testclient import TestClient  # noqa: E402

from app import main as main_module  # noqa: E402
from app.main import app  # noqa: E402


def lock(release: str, fingerprint: str) -> dict:
    return {
        "schema": "releasetruth.behavior/v1",
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
            "score": {"score": 0.0, "countsBySeverity": {"breaking": 1}},
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
        assert body["compatibility_score"] == 0.0
        assert body["changes"][0]["severity"] == "breaking"

        baseline = client.put(
            f"/v1/projects/{project['id']}/baseline",
            json={"snapshot_id": body["base_snapshot_id"], "set_by": "test"},
        )
        assert baseline.status_code == 200
        assert client.get(f"/v1/projects/{project['id']}/baseline").status_code == 200
        assert len(client.get(f"/v1/projects/{project['id']}/history").json()) == 1
        assert len(client.get(f"/v1/projects/{project['id']}/snapshots").json()) == 2

        summary = client.get("/v1/summary").json()
        assert summary["projects"] == 1
        assert summary["runs"] == 1
        assert summary["breaking_changes"] == 1
        assert summary["average_score"] == 0.0


def github_signature(secret: str, body: bytes) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_github_webhook_is_disabled_by_default(monkeypatch) -> None:
    monkeypatch.setattr(main_module.settings, "github_webhook_enabled", False)
    with TestClient(app) as client:
        response = client.post("/v1/github/webhook", json={"action": "opened"})
    assert response.status_code == 404


def test_github_webhook_requires_secret_when_enabled(monkeypatch) -> None:
    monkeypatch.setattr(main_module.settings, "github_webhook_enabled", True)
    monkeypatch.setattr(main_module.settings, "github_webhook_secret", None)
    monkeypatch.setattr(main_module.settings, "github_webhook_allow_unsigned_dev", False)
    with TestClient(app) as client:
        response = client.post("/v1/github/webhook", json={"action": "opened"})
    assert response.status_code == 503


def test_github_webhook_signature_and_duplicate_delivery(monkeypatch) -> None:
    secret = "unit-test-secret"
    monkeypatch.setattr(main_module.settings, "github_webhook_enabled", True)
    monkeypatch.setattr(main_module.settings, "github_webhook_secret", secret)
    monkeypatch.setattr(main_module.settings, "github_webhook_allow_unsigned_dev", False)
    body = b'{"action":"opened","pull_request":{"number":7}}'
    base_headers = {
        "content-type": "application/json",
        "x-github-event": "pull_request",
        "x-github-delivery": "delivery-webhook-test-1",
    }
    with TestClient(app) as client:
        missing = client.post("/v1/github/webhook", content=body, headers=base_headers)
        assert missing.status_code == 401
        invalid = client.post(
            "/v1/github/webhook",
            content=body,
            headers={**base_headers, "x-hub-signature-256": "sha256=bad"},
        )
        assert invalid.status_code == 401
        headers = {**base_headers, "x-hub-signature-256": github_signature(secret, body)}
        accepted = client.post("/v1/github/webhook", content=body, headers=headers)
        assert accepted.status_code == 202
        assert accepted.json() == {"status": "accepted"}
        duplicate = client.post("/v1/github/webhook", content=body, headers=headers)
        assert duplicate.status_code == 200
        assert duplicate.json() == {"status": "duplicate"}


def test_github_unsigned_mode_is_explicitly_dev_only(monkeypatch) -> None:
    monkeypatch.setattr(main_module.settings, "github_webhook_enabled", True)
    monkeypatch.setattr(main_module.settings, "github_webhook_secret", None)
    monkeypatch.setattr(main_module.settings, "github_webhook_allow_unsigned_dev", True)
    with TestClient(app) as client:
        response = client.post(
            "/v1/github/webhook",
            json={"action": "ping"},
            headers={"x-github-delivery": "delivery-webhook-test-dev"},
        )
    assert response.status_code == 202

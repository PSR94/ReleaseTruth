# ReleaseTruth API

The FastAPI service is a persistence and collaboration layer for deterministic ReleaseTruth artifacts. It does not replace the Rust comparison engine.

Default local URL: `http://127.0.0.1:8000`.

FastAPI also exposes generated OpenAPI documentation at `/docs` while the service is running.

## Health

### `GET /health`

Returns service/version status.

## Projects

### `POST /v1/projects`

Creates a project from `name`, `slug`, and optional `repository_url`. Slugs are unique.

### `GET /v1/projects`

Lists projects newest first.

### `GET /v1/projects/{project_id}`

Returns one project or `404`.

## Snapshots

### `POST /v1/snapshots`

Persists a behavior lock for a project. Snapshots are deduplicated per project by fingerprint.

### `GET /v1/projects/{project_id}/snapshots`

Lists project snapshots newest first.

## Runs

### `POST /v1/runs/ingest`

Persists a deterministic comparison. Payload fields:

```json
{
  "project_id": "...",
  "base_lock": {},
  "candidate_lock": {},
  "report": {},
  "git_sha": "optional",
  "pull_request": 123
}
```

The service ensures both snapshots exist, stores the report, creates queryable change rows, and returns run detail.

### `GET /v1/runs`

Lists runs. Optional query parameters:

- `project_id`
- `limit` (`1..200`, default `50`)

### `GET /v1/runs/{run_id}`

Returns run detail including the persisted report and changes.

### `GET /v1/projects/{project_id}/history`

Returns up to 200 project runs newest first.

## Baselines

### `PUT /v1/projects/{project_id}/baseline`

Sets an existing project snapshot as the server baseline:

```json
{
  "snapshot_id": "...",
  "set_by": "optional actor"
}
```

### `GET /v1/projects/{project_id}/baseline`

Returns the active baseline or `404` when none is set.

## Summary

### `GET /v1/summary`

Returns project, snapshot and run counts; breaking/significant change totals; and average compatibility score for dashboard overview metrics.

## GitHub webhook

### `POST /v1/github/webhook`

Webhook ingestion is **disabled by default**. When enabled with `RELEASETRUTH_GITHUB_WEBHOOK_ENABLED=true`, production deployments must configure `RELEASETRUTH_GITHUB_WEBHOOK_SECRET`.

The endpoint verifies `X-Hub-Signature-256` using HMAC-SHA256, records the delivery ID/event/action/payload, and returns `200 {"status":"duplicate"}` for an already-seen delivery. Missing or invalid signatures return `401`; an enabled endpoint with no secret returns `503` unless the explicit unsigned development flag is enabled.

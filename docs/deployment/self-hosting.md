# Self-hosting ReleaseTruth

The supported v0.1 self-hosting path is Docker Compose. It runs PostgreSQL, the FastAPI service, the Next.js dashboard, and both TruthShop demo variants.

## Start

```bash
cp .env.example .env
# edit values if needed
docker compose up --build -d
```

Check health:

```bash
curl -fsS http://localhost:8000/health
curl -fsS http://localhost:3002/
```

Stop services:

```bash
docker compose down
```

Use `docker compose down -v` only when you also intend to delete the PostgreSQL volume.

## Services

| Service | Host access | Purpose |
| --- | --- | --- |
| `postgres` | internal `postgres:5432` | durable project/snapshot/run storage |
| `api` | `localhost:8000` | ingestion, history, baseline, summary, webhook API |
| `dashboard` | `localhost:3002` | compatibility history and evidence UI |
| `truthshop-good` | `localhost:3000` | base behavior demo target |
| `truthshop-regression` | `localhost:3001` | intentional regression target |

The API healthcheck waits for Uvicorn. The API depends on a healthy PostgreSQL service. The dashboard depends on a healthy API.

## Database migrations

The API image runs:

```bash
alembic upgrade head
```

before starting Uvicorn. To apply migrations manually from a development checkout:

```bash
cd apps/api
RELEASETRUTH_DATABASE_URL='postgresql+psycopg://user:password@host:5432/releasetruth' alembic upgrade head
```

Do not use SQLAlchemy `create_all` as the production migration mechanism. Automatic `create_all` is intentionally limited to SQLite local mode.

## Environment

Important variables:

```text
RELEASETRUTH_DATABASE_URL
RELEASETRUTH_CORS_ORIGINS
RELEASETRUTH_API_URL
RELEASETRUTH_GITHUB_WEBHOOK_ENABLED
RELEASETRUTH_GITHUB_WEBHOOK_SECRET
RELEASETRUTH_GITHUB_WEBHOOK_ALLOW_UNSIGNED_DEV
```

`RELEASETRUTH_GITHUB_WEBHOOK_ENABLED=false` is the default. If webhook ingestion is enabled in an exposed environment, set a strong `RELEASETRUTH_GITHUB_WEBHOOK_SECRET` and configure GitHub to use the same secret.

`RELEASETRUTH_GITHUB_WEBHOOK_ALLOW_UNSIGNED_DEV=true` is deliberately insecure and exists only for isolated local development.

## Production considerations

The v0.1 Compose file is a reference deployment, not a managed hosting product. Before exposing it publicly, add the controls appropriate for your environment: TLS/reverse proxy, authentication/authorization, secret management, network policy, backups, observability, resource limits, evidence retention and isolated workers for any untrusted capture workload.

ReleaseTruth does not sandbox hostile CLI programs or hostile browser/API scenarios. Treat capture configuration with the same trust as executable repository code.

# Testing and validation

ReleaseTruth v0.1 pins Rust 1.98.1 for reproducible development and CI. The workspace declares Rust 1.98 as its pre-1.0 MSRV and commits `Cargo.lock` because the repository ships an application/CLI.

## Canonical local gate

```bash
make release-check
```

The wrapper executes the same categories used by release automation: Rust, TypeScript/Next.js, Python, container builds and the runtime behavioral E2E.

## Rust

```bash
cargo fmt --all -- --check
cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
cargo test --locked --workspace
```

Core tests cover normalization noise, deterministic fingerprints, stable keyed-array diffing, release-critical classification, expected-change acceptance, scoring weights and complete pipeline behavior.

## TypeScript and Next.js

```bash
pnpm install --frozen-lockfile
pnpm lint:ts
pnpm test:ts
pnpm build:ts
```

Adapters have focused unit tests and the dashboard has filter tests. Next.js apps are production-built as part of the same check.

## FastAPI

```bash
python -m pip install -e 'apps/api[dev]'
ruff check apps/api
pytest -q apps/api
```

CI additionally starts PostgreSQL and runs:

```bash
cd apps/api
RELEASETRUTH_DATABASE_URL='postgresql+psycopg://releasetruth:releasetruth@127.0.0.1:5432/releasetruth' alembic upgrade head
```

This catches migration problems independently of the SQLite local-mode tests.

## Containers

```bash
docker compose build api dashboard truthshop-good truthshop-regression
```

## Full behavioral E2E

Install Chromium and run:

```bash
pnpm --filter @releasetruth/browser-adapter exec playwright install chromium
./scripts/e2e.sh
```

The E2E:

1. starts the FastAPI service
2. builds/starts good and regression TruthShop releases
3. captures all six surfaces
4. re-finalizes the base draft and requires the same fingerprint
5. compares and validates JSON/Markdown/JUnit/SARIF/HTML output
6. asserts the flagship API/browser/accessibility/CLI/events/performance regressions
7. ingests the report into the API
8. starts the dashboard and verifies run evidence is rendered
9. captures full-page dashboard screenshots under `.releasetruth/e2e/`

GitHub Actions uploads `.releasetruth/` even when E2E fails so logs/evidence are available for diagnosis.

## CI jobs

`.github/workflows/ci.yml` runs:

- `Rust checks`
- `TypeScript and Next.js checks`
- `FastAPI checks`
- `Container build smoke`
- `Composite Action smoke`
- `Behavioral capture to dashboard E2E`

E2E depends on every preceding validation job, so the runtime proof only runs after static/unit/build gates are green.

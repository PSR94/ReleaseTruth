#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

printf '==> Rust format, clippy, and tests\n'
cargo fmt --all -- --check
cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
cargo test --locked --workspace

printf '==> TypeScript install, typecheck, tests, and builds\n'
pnpm install --frozen-lockfile
pnpm check:ts

printf '==> FastAPI lint and tests\n'
python -m pip install -e 'apps/api[dev]'
ruff check apps/api
pytest -q apps/api

printf '==> Container builds\n'
docker compose build

printf '==> Browser runtime and full behavioral E2E\n'
pnpm --filter @releasetruth/browser-adapter exec playwright install chromium
./scripts/e2e.sh

printf '==> ReleaseTruth release check passed\n'

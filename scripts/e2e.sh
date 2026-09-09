#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
OUT="$ROOT/.releasetruth/e2e"
mkdir -p "$OUT"

python -m uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 8000 >"$OUT/api.log" 2>&1 &
API_PID=$!
DASH_PID=""
cleanup() {
  kill "$API_PID" 2>/dev/null || true
  if [[ -n "$DASH_PID" ]]; then kill "$DASH_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

wait_http() {
  local url="$1"
  for _ in $(seq 1 80); do
    if curl -fsS "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

wait_http http://127.0.0.1:8000/health
RELEASETRUTH_API_URL=http://127.0.0.1:8000 ./scripts/demo.sh

RELEASETRUTH_API_URL=http://127.0.0.1:8000 pnpm --filter @releasetruth/dashboard exec next start -H 127.0.0.1 -p 3002 >"$OUT/dashboard.log" 2>&1 &
DASH_PID=$!
wait_http http://127.0.0.1:3002

RELEASETRUTH_API_URL=http://127.0.0.1:8000 RELEASETRUTH_DASHBOARD_URL=http://127.0.0.1:3002 node scripts/verify-e2e.mjs

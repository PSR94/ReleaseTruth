#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
CANDIDATE_URL="${CANDIDATE_URL:-http://127.0.0.1:3001}"
OUT="$ROOT/.releasetruth/demo"
mkdir -p "$OUT"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }; }
need cargo
need node
need pnpm

printf '==> Building ReleaseTruth and TruthShop\n'
cargo build --workspace
pnpm install --no-frozen-lockfile
pnpm build:ts
pnpm --filter @releasetruth/truthshop build
pnpm exec playwright install chromium >/dev/null

printf '==> Starting TruthShop base and candidate\n'
TRUTHSHOP_VARIANT=good pnpm --filter @releasetruth/truthshop exec next start -H 127.0.0.1 -p 3000 >"$OUT/truthshop-base.log" 2>&1 &
BASE_PID=$!
TRUTHSHOP_VARIANT=regression pnpm --filter @releasetruth/truthshop exec next start -H 127.0.0.1 -p 3001 >"$OUT/truthshop-candidate.log" 2>&1 &
CANDIDATE_PID=$!
cleanup() { kill "$BASE_PID" "$CANDIDATE_PID" 2>/dev/null || true; }
trap cleanup EXIT

wait_for() {
  local url="$1"
  for _ in $(seq 1 60); do
    if node -e "fetch(process.argv[1]).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" "$url"; then return 0; fi
    sleep 1
  done
  echo "Timed out waiting for $url" >&2
  return 1
}
wait_for "$BASE_URL/api/products"
wait_for "$CANDIDATE_URL/api/products"

capture_variant() {
  local variant="$1" release="$2" target="$3" dir="$4"
  rm -rf "$dir"
  mkdir -p "$dir"
  node packages/runner/dist/cli.js --target "$target" --output "$dir" --config "$ROOT/.releasetruth.demo.yml" --release "$release" --variant "$variant"
  cargo run -q -p releasetruth -- capture --input "$dir/draft.behavior.lock.json" --output "$dir" --config "$ROOT/.releasetruth.demo.yml"
}

printf '==> Capturing base behavior\n'
capture_variant good v1-good "$BASE_URL" "$OUT/base"
printf '==> Capturing candidate behavior\n'
capture_variant regression v2-regression "$CANDIDATE_URL" "$OUT/candidate"

BASE_LOCK="$OUT/base/behavior.lock.json"
CANDIDATE_LOCK="$OUT/candidate/behavior.lock.json"
printf '==> Comparing behavior\n'
cargo run -q -p releasetruth -- compare "$BASE_LOCK" "$CANDIDATE_LOCK" --config "$ROOT/.releasetruth.demo.yml" --format text --fail-on never
cargo run -q -p releasetruth -- compare "$BASE_LOCK" "$CANDIDATE_LOCK" --config "$ROOT/.releasetruth.demo.yml" --format json --output "$OUT/report.json" --fail-on never
cargo run -q -p releasetruth -- compare "$BASE_LOCK" "$CANDIDATE_LOCK" --config "$ROOT/.releasetruth.demo.yml" --format markdown --output "$OUT/report.md" --fail-on never
cargo run -q -p releasetruth -- compare "$BASE_LOCK" "$CANDIDATE_LOCK" --config "$ROOT/.releasetruth.demo.yml" --format sarif --output "$OUT/report.sarif" --fail-on never
cargo run -q -p releasetruth -- compare "$BASE_LOCK" "$CANDIDATE_LOCK" --config "$ROOT/.releasetruth.demo.yml" --format html --output "$OUT/report.html" --fail-on never

printf '\nDemo complete.\n  HTML: %s\n  JSON: %s\n  Base: %s\n  Candidate: %s\n' "$OUT/report.html" "$OUT/report.json" "$BASE_LOCK" "$CANDIDATE_LOCK"

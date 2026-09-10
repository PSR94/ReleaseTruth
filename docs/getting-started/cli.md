# CLI quick start

The Rust CLI owns deterministic finalization, comparison, scoring, report rendering and local provenance. Runtime adapters emit draft behavior-lock JSON; `releasetruth capture` applies configured normalization, canonicalizes observation identity/order, computes the behavioral fingerprint and writes `behavior.lock.json`.

## Build

```bash
cargo build --locked --release -p releasetruth
# binary: target/release/releasetruth
```

Or install from a checkout:

```bash
cargo install --locked --path crates/cli
```

## Initialize and diagnose

```bash
releasetruth init
releasetruth doctor
```

`init` creates `.releasetruth.yml` unless it already exists. `doctor` validates configuration and can also verify a behavior lock:

```bash
releasetruth doctor --lock .releasetruth/base/behavior.lock.json
```

## Capture/finalize

```bash
releasetruth capture \
  --input .releasetruth/base/draft.behavior.lock.json \
  --output .releasetruth/base \
  --release v1-good \
  --record-history \
  --git-sha "$(git rev-parse HEAD)"
```

When `--output` is a directory, the command writes `behavior.lock.json` inside it. `--record-history` appends the finalized lock to `.releasetruth/history.json` after verifying its fingerprint.

## Compare

```bash
releasetruth compare \
  .releasetruth/base/behavior.lock.json \
  .releasetruth/candidate/behavior.lock.json \
  --config .releasetruth.yml \
  --format text \
  --fail-on breaking
```

Report formats:

```bash
releasetruth compare base.json candidate.json --format text
releasetruth compare base.json candidate.json --format json
releasetruth compare base.json candidate.json --format markdown
releasetruth compare base.json candidate.json --format junit
releasetruth compare base.json candidate.json --format sarif
releasetruth compare base.json candidate.json --format html --output report.html
```

`--fail-on` accepts `breaking`, `significant`, `minor`, or `never`.

Exit codes are `0` for an accepted comparison, `1` for operational/configuration/schema/fingerprint errors, and `2` when a comparison reaches the selected compatibility threshold.

## Fingerprints

Compute the fingerprint implied by a lock:

```bash
releasetruth fingerprint behavior.lock.json
```

Verify the stored fingerprint:

```bash
releasetruth fingerprint behavior.lock.json --verify
```

## Baseline

Set the local baseline:

```bash
releasetruth baseline .releasetruth/base/behavior.lock.json
```

Inspect it:

```bash
releasetruth baseline
```

The default local baseline store is `.releasetruth/baseline.json`.

## History

List recent deterministic captures:

```bash
releasetruth history --limit 20
```

Record an already-finalized lock explicitly:

```bash
releasetruth history --record behavior.lock.json --git-sha "$(git rev-parse HEAD)"
```

The default store is `.releasetruth/history.json`.

## Blame a behavioral change

Given a stable ReleaseTruth change ID from a report, find the first recorded release where it appears relative to a baseline:

```bash
releasetruth blame .releasetruth/base/behavior.lock.json chg-...
```

## Find the first regression

Find the first recorded release that crosses a severity threshold relative to the supplied baseline:

```bash
releasetruth bisect .releasetruth/base/behavior.lock.json --fail-on breaking
```

This is deterministic history analysis; it does not invoke `git bisect` or execute arbitrary historical builds.

## Real adapter capture

The repository runner is the current URL/command orchestration layer. TruthShop demonstrates it end to end:

```bash
make demo
```

The runner loads `.releasetruth.demo.yml`, executes browser/API/accessibility/CLI/event/performance scenarios and produces the draft consumed by `releasetruth capture`.

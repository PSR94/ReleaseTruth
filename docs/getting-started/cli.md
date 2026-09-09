# CLI quick start

The Rust CLI owns deterministic finalization and comparison. Capture adapters emit draft behavior-lock JSON; `releasetruth capture` applies the configured normalization rules, sorts observation identities, computes the behavioral fingerprint, and writes the immutable contract.

```bash
cargo run -p releasetruth -- init
cargo run -p releasetruth -- capture --input fixtures/truthshop/base.draft.json --output .releasetruth/base
cargo run -p releasetruth -- capture --input fixtures/truthshop/candidate.draft.json --output .releasetruth/candidate
cargo run -p releasetruth -- compare .releasetruth/base/behavior.lock.json .releasetruth/candidate/behavior.lock.json
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

Exit codes are `0` for success/accepted compatibility, `1` for operational or configuration errors, and `2` when a comparison reaches the `--fail-on` threshold. The default threshold is `breaking`.

The adapter orchestration layer will make URL/command capture the common user-facing path; the draft-finalization command is intentionally public because custom adapters and CI pipelines need a stable deterministic ingestion boundary.

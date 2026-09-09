# ReleaseTruth

> Git shows what code changed. ReleaseTruth shows what your product actually changed.

ReleaseTruth is an open-source cross-surface behavioral diff engine. It captures externally observable behavior from two application releases, normalizes the observations, compares them deterministically, and produces evidence-backed compatibility reports.

The project is being built around a versioned behavioral contract, `behavior.lock.json`, with deterministic normalization, canonicalization, fingerprinting, comparison, classification, and scoring. AI is optional and never the source of truth.

## Core idea

```text
CODE DIFF
73 files changed
    |
    v
RELEASETRUTH
    |
    v
ACTUAL PRODUCT DIFF
API:            400 -> 422
Accessibility:  button -> generic element
Performance:    280 ms -> 472 ms
CLI:            exit 0 -> exit 1
Webhook:        event ordering changed
```

## Status

ReleaseTruth v0.1.0 is under active construction. The repository is intentionally initialized with this commit before the deterministic core and adapters are added in focused commits.

## License

Apache-2.0 (see `LICENSE` once the initial repository foundation commit lands).

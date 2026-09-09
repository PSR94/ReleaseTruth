# Contributing to ReleaseTruth

Thanks for helping improve ReleaseTruth.

## Principles

1. Deterministic evidence is the source of truth.
2. Noise reduction is a product feature, not test cleanup.
3. A reported change must be traceable to concrete evidence.
4. Adapters should capture observable behavior without pretending to cover what they do not observe.
5. Demo paths must exercise the real engine.

## Development loop

```bash
make setup
make lint
make test
```

Rust changes should pass `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, and `cargo test --workspace`.

Python and web checks are documented in their respective directories as those components are introduced.

## Pull requests

Keep changes focused, explain externally observable behavior changes, add tests for classification/normalization changes, and update the behavior-lock schema documentation when the serialized contract changes.

By contributing, you agree that your contribution is licensed under Apache-2.0.

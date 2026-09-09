# Testing and validation

The canonical local checks are:

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace
```

GitHub Actions runs the same Rust checks on pushes and pull requests. CI is intentionally treated as a product feature: ReleaseTruth must not claim a build or test status that was not actually produced by a runner.

As TypeScript, Python, container, and E2E components are added, their checks live in the same CI workflow or focused reusable workflows and are invoked by `make lint` / `make test` locally.

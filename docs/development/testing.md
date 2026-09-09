# Testing and validation

ReleaseTruth v0.1 pins Rust 1.98.1 for reproducible development and CI. The workspace declares an MSRV of Rust 1.98 while the project is pre-1.0; this policy will be revisited before a stable 1.0 release.

The canonical Rust checks are:

```bash
cargo fmt --all -- --check
cargo clippy --locked --workspace --all-targets --all-features -- -D warnings
cargo test --locked --workspace
```

`Cargo.lock` is committed because the repository ships an application/CLI, and CI uses `--locked` so dependency resolution cannot drift silently.

GitHub Actions runs the same checks on pushes and pull requests. CI is intentionally treated as a product feature: ReleaseTruth must not claim a build or test status that was not actually produced by a runner.

As TypeScript, Python, container, and E2E components are added, their checks live in the same CI workflow or focused reusable workflows and are invoked by `make lint` / `make test` locally.

# Changelog

All notable changes to ReleaseTruth are documented here. The project follows Semantic Versioning.

## [Unreleased]

No unreleased user-facing changes yet.

## [0.1.0] - 2026-09-09

### Added

- Versioned `releasetruth.behavior/v1` behavioral contract and JSON schemas.
- Deterministic normalization, canonicalization, SHA-256 fingerprinting, structural diffing, classification, expected-change acceptance, and weighted compatibility scoring.
- Rust CLI commands for `init`, `doctor`, `capture`, `compare`, `fingerprint`, `baseline`, `history`, `blame`, and `bisect`.
- Text, JSON, Markdown, JUnit, SARIF, and standalone HTML comparison reports.
- Browser, API, accessibility, CLI, event/webhook, and performance adapters plus YAML-driven runner.
- TruthShop good/regression releases demonstrating API status, browser confirmation, accessibility semantics/focus, CLI exit, event ordering, cookie, layout, and performance changes.
- Local deterministic capture history, baseline management, change-origin lookup, and first-regression identification.
- FastAPI persistence service for projects, snapshots, runs, changes, baselines, summary metrics, and GitHub webhook deliveries.
- SQLite local mode and PostgreSQL deployment mode with Alembic migrations.
- Next.js dashboard with project history, baseline context, compatibility score/status, six-surface summaries, severity/surface/search filters, before/after values, and evidence references.
- Composite GitHub Action for Markdown/JSON/SARIF rendering and compatibility gating.
- Dockerfiles and Docker Compose stack for PostgreSQL, API, dashboard, and both TruthShop variants.
- CI covering Rust, TypeScript/Next.js, FastAPI, PostgreSQL migration smoke, container builds, composite-action smoke, and full behavioral E2E.
- Tag release workflow that revalidates the project before building Linux/macOS/Windows CLI archives and SHA-256 checksums.
- Real E2E dashboard screenshots stored with CI evidence artifacts.
- Apache-2.0 license, contribution/security/support policies, ADRs, prior-art research, self-hosting/API/integration/security documentation, and v0.1 release checklist.

### Security

- GitHub webhook ingestion is disabled by default, requires an HMAC secret when enabled for production, rejects missing/invalid signatures, and records delivery IDs idempotently.
- CLI scenarios execute with `shell: false` by default in temporary working directories with timeouts.
- Runtime capture adapters redact known credential/cookie/password-like material before persistence where applicable.

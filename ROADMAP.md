# Roadmap

ReleaseTruth is intentionally evidence-first: deterministic behavioral contracts and comparison stay stable while collection surfaces and collaboration features expand.

## v0.1.0 — implemented

- `behavior.lock` v1 schema and explicit migration boundary
- normalization, canonicalization, hashing, diffing, deterministic classification and weighted scoring
- CLI init/doctor/capture/compare/fingerprint/baseline/history/blame/bisect lifecycle
- API, browser, accessibility, CLI, events and performance adapters
- TruthShop six-surface regression proof target
- text, JSON, Markdown, JUnit, SARIF and standalone HTML reports
- composite GitHub Action and CI smoke coverage
- FastAPI persistence service with SQLite local mode and PostgreSQL + Alembic deployment mode
- Next.js dashboard with baseline/history context and change filtering
- Docker Compose self-hosting path and end-to-end capture → persistence → dashboard verification
- tag-driven cross-platform CLI release workflow

## v0.2 candidates

- native GitHub App installation/onboarding and richer PR annotations
- remote evidence/object storage with retention controls
- authenticated multi-user projects and deployment hardening
- richer source/commit correlation and coverage analytics
- adapter SDK and external adapter/plugin lifecycle
- GraphQL, gRPC and database behavioral adapters
- distributed capture workers for isolated browser/CLI execution

## Later

- GitLab and additional CI provider integrations
- mobile/device behavioral surfaces
- hosted execution/control plane
- adapter marketplace
- optional AI explanation providers, always downstream of deterministic evidence and never responsible for the compatibility verdict

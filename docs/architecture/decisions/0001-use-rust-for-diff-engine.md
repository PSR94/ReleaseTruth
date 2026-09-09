# ADR 0001: Use Rust for the deterministic engine and CLI

- Status: Accepted
- Date: 2026-09-09

## Context

ReleaseTruth processes potentially large structured capture sets and must produce reproducible normalization, fingerprints, diffs, classifications, and reports in local and CI environments.

## Decision

Implement the behavior model, normalization/canonicalization, fingerprints, diff engine, classification, scoring, and primary CLI in Rust. Browser execution remains TypeScript/Playwright; the platform API remains Python/FastAPI.

## Consequences

Rust gives a single deterministic implementation for CLI and library use, strong serialized-type boundaries, predictable resource use, and straightforward static binaries. Cross-language adapters communicate through explicit JSON artifacts instead of duplicating comparison rules.

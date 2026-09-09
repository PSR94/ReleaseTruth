# ADR 0002: Version behavior.lock as an explicit contract

- Status: Accepted
- Date: 2026-09-09

## Context

Behavior snapshots need long-lived compatibility, deterministic hashes, historical comparison, and migrations independent of implementation refactors.

## Decision

The serialized root includes a URI-like schema discriminator (`releasetruth.behavior/v1`), capture metadata, typed surface observations, normalization metadata, evidence references, and a SHA-256 fingerprint. JSON Schema is committed under `schemas/behavior/v1/`.

Readers reject unknown major schema versions with an actionable error. Migration functions are explicit and side-effect free. Additive fields may be introduced compatibly within v1 when old readers can safely ignore them.

## Consequences

The format can be versioned and audited independently of the CLI. Snapshot fingerprints must be computed from canonical content with the root fingerprint field omitted.

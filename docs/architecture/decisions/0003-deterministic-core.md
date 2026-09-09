# ADR 0003: Deterministic evidence is authoritative

- Status: Accepted
- Date: 2026-09-09

## Context

Behavioral testing contains volatile timestamps, IDs, request tokens, host-specific paths, array ordering, and performance noise. AI-generated interpretations cannot provide reproducible CI guarantees.

## Decision

The core pipeline is:

`capture -> redact -> normalize -> canonicalize -> fingerprint -> compare -> classify -> score -> report`

Rules and weights are serialized configuration. Each diff carries before/after values, severity, confidence, a stable ID, classification reason, and evidence references. AI providers, if added, receive already-computed structured diffs and cannot alter evidence or the deterministic score.

## Consequences

Users can reproduce compatibility results offline. New normalization or classification semantics require tests and changelog entries because they may change fingerprints or scores.

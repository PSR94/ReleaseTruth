# `behavior.lock.json` specification

`behavior.lock.json` is ReleaseTruth's versioned behavioral contract. It records normalized, externally observable product behavior, not source-code intent.

## v1 invariants

- Root schema discriminator: `releasetruth.behavior/v1`.
- Observations belong to one of six first-class surfaces: browser, API, CLI, accessibility, events, performance.
- Observation `id` is stable within a surface and is the primary pairing key during comparison.
- `attributes` contain adapter-owned structured values. Object key order is never meaningful; array order is meaningful unless configuration explicitly normalizes it.
- Evidence is referenced by ID so every diff can be traced back to artifacts without embedding large files in the lock.
- Secrets must be redacted before persistence.
- `fingerprint` is SHA-256 over schema + normalized surfaces + normalization manifest. Release label, capture time, source metadata, evidence storage paths, and the fingerprint field itself are excluded.

## Compatibility policy

Readers reject unknown schema majors instead of guessing. v1 may gain optional additive fields when older v1 readers can safely ignore them. A change that alters the meaning of existing serialized fields requires a new schema major and an explicit migration function.

## Determinism

Object keys are canonicalized lexicographically. Observations are sorted by stable ID. Arrays retain order by default because order can be observable behavior (for example event sequences and navigation order). Users may mark specific arrays as unordered through normalization rules.

Volatile timestamps, UUIDs, localhost ports, and temporary paths have conservative default normalization rules scoped to captured surfaces. User rules can remove, replace, regex-normalize, or sort explicitly addressed values.

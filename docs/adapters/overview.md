# Adapter architecture

Adapters execute potentially noisy or privileged operations; the Rust core does not. Each adapter emits the same two things:

1. structured `Observation` records for one surface, and
2. concrete evidence artifacts referenced by stable IDs.

The deterministic CLI then redacts/normalizes as configured, canonicalizes observations, fingerprints the behavioral payload, compares releases, classifies changes, and scores the result.

## Implemented adapter libraries

- `adapters/api`: actual HTTP requests, status/headers/body/timing, credential redaction.
- `adapters/browser`: Playwright journeys, meaningful DOM state, network calls, console errors, storage keys, cookie attributes, screenshots, focus state.
- `adapters/accessibility`: axe-core plus semantic control/heading/focus observations.
- `adapters/cli`: argv-based process execution in isolated temporary directories, timeouts, stdout/stderr/exit code/filesystem snapshot.
- `adapters/events`: local webhook receiver with order, headers, payload, and relative timing.
- `adapters/performance`: deterministic p50/p95 summaries over repeated samples.

Adapters intentionally do not classify severity. Classification belongs to the deterministic core so the same evidence receives the same verdict regardless of capture implementation.

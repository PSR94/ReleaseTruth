# Compatibility scoring

ReleaseTruth scores deterministic classified changes; it does not ask an AI model for a number.

## Default penalties

| Severity | Base penalty |
| --- | ---: |
| expected | 0 |
| minor | 1 |
| significant | 7 |
| breaking | 20 |

Default surface multipliers are API 1.0, accessibility 1.25, browser 1.0, CLI 1.0, events 0.75, and performance 0.5.

For every change:

`penalty = severity_penalty × surface_weight`

Then:

`score = clamp(100 - sum(change penalties), 0, 100)`

The report exposes total penalty, counts per severity, penalty per severity, and penalty per surface. Configuration may change weights, but the exact effective configuration belongs in report metadata so the result can be reproduced.

Accepted changes are reclassified as `expected` and therefore contribute zero penalty; the underlying before/after evidence is preserved.

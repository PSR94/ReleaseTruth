# Normalization and noise reduction

A behavioral diff is useful only when it suppresses irrelevant volatility without erasing real behavior.

ReleaseTruth's order of operations is `capture -> redact -> normalize -> canonicalize -> fingerprint -> compare`.

## Defaults

The deterministic core normalizes common UUIDs, ISO-8601 timestamps, ephemeral localhost ports, and temporary paths inside captured surfaces. It does **not** reorder arrays by default.

## Explicit rules

Rules use JSON Pointer paths:

- `replace_regex`: replace text matching a regex, optionally under one subtree.
- `remove`: remove an addressed field/item.
- `replace`: replace an addressed value with a stable JSON value.
- `sort_array`: sort an array by canonical JSON when the user knows order is not behavior.

Normalization should be as narrow as possible. If event ordering, tab order, search ranking, redirect order, or filesystem ordering matters to consumers, do not sort it away.

## Redaction is separate

Redaction happens before normalization. A normalization rule is not a security control: it may stabilize a token but still leak it if the replacement pattern misses a case. Adapters are responsible for default secret redaction before evidence is written.

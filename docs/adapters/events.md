# Event/webhook adapter

The v0.1 event adapter is a local HTTP collector intended for deterministic demos and integration scenarios. It binds to loopback on an ephemeral port and records event sequence, method/path, redacted headers, parsed payload, and relative arrival time.

The resulting observation includes an explicit `order` array so swapped events remain detectable. Authorization and Cookie headers are omitted. Retry/duplicate behavior appears naturally as repeated captured events; higher-level retry classification remains roadmap work.

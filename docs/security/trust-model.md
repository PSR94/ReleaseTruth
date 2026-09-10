# Security and trust model

ReleaseTruth executes network and local-runtime observations supplied by repository configuration. The primary security boundary is therefore the environment in which capture runs.

## Trusted inputs

Treat these as executable-code-equivalent inputs:

- `.releasetruth.yml` journeys and scenarios
- target URLs and API endpoints
- CLI executable/argv definitions
- custom normalization expressions
- any externally supplied adapter artifacts

Do not run capture configuration from an untrusted source on a workstation or runner with sensitive network/file access.

## CLI execution

The CLI adapter defaults to `shell: false`; command + argv are passed directly instead of interpolating a shell command string. Scenarios run in dedicated temporary working directories and have timeouts.

This is defense in depth, not sandboxing. ReleaseTruth cannot make a hostile executable safe. Use containers/VMs/isolated workers for untrusted native programs.

## Browser and network capture

Browser/API/event scenarios can access URLs reachable from the capture runner, including private networks. Restrict runner egress and credentials when evaluating untrusted configuration.

Browser evidence can include DOM text, console/network metadata, storage state and screenshots. API evidence can include response bodies and headers. Review retention and access controls before uploading artifacts from sensitive environments.

## Redaction

Adapters redact known authorization, cookie, API-key and password-like values where the adapter understands those fields. Redaction is intentionally conservative and cannot guarantee arbitrary application secrets embedded in free-form content will be discovered.

Use explicit normalization/removal rules for additional sensitive dynamic values before persisting or sharing a capture.

## Evidence integrity

Behavior fingerprints are deterministic SHA-256 hashes over normalized behavioral content and the normalization manifest. Release metadata, timestamps and evidence storage paths are excluded so relocation does not change identity.

A behavior lock can be verified with:

```bash
releasetruth fingerprint behavior.lock.json --verify
```

Local history/baseline tooling verifies stored fingerprints before using records for provenance analysis.

## GitHub webhook boundary

Webhook ingestion is disabled by default. When enabled:

- configure `RELEASETRUTH_GITHUB_WEBHOOK_SECRET`
- GitHub's `X-Hub-Signature-256` is verified with HMAC-SHA256 using constant-time comparison
- missing/invalid signatures are rejected
- delivery IDs are stored uniquely so retries are idempotent

`RELEASETRUTH_GITHUB_WEBHOOK_ALLOW_UNSIGNED_DEV=true` disables the signature requirement only when no secret is configured. Never use it on an exposed deployment.

## Server exposure

The reference Docker Compose stack does not provide authentication, TLS termination, tenant isolation or managed secret storage. Put the API/dashboard behind controls appropriate to your environment before public exposure.

See also [SECURITY.md](../../SECURITY.md) for vulnerability reporting and supported-version policy.

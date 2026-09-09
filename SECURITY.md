# Security Policy

ReleaseTruth executes browser journeys, HTTP scenarios, and optionally local commands against developer-supplied targets. Treat capture configuration as code with the same trust level as the repository that contains it.

## Supported version

Security fixes are applied to the latest `0.x` release while the project is pre-1.0.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for this repository. Include affected version, impact, reproduction steps, and any suggested mitigation.

## Trust model

- ReleaseTruth does **not** safely sandbox hostile native binaries. CLI scenarios are intended for code you already trust enough to execute in CI.
- CLI commands are represented as executable plus argv, not interpolated shell strings, unless a user explicitly opts into shell mode.
- CLI scenarios run in dedicated temporary working directories with timeouts.
- Authorization headers, cookies, tokens, and password-like fields are redacted before persistence by default.
- Browser targets and API endpoints may reach internal networks; run untrusted configurations only inside appropriately isolated infrastructure.
- Captures can contain sensitive data. Inspect redaction rules before sharing artifacts or uploading CI results.

See `docs/security/trust-model.md` for the detailed boundary model.

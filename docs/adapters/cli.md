# CLI adapter

CLI scenarios run in fresh temporary working directories. A seed directory can be copied in before execution. The adapter records stdout, stderr, exit code, timeout state, duration, and a deterministic filesystem tree with SHA-256 hashes for files up to 1 MB.

By default commands are executed as an executable plus argv with `shell: false`; this avoids accidental shell interpolation. `shell: true` is an explicit opt-in for trusted scenarios only.

This is isolation for repeatability, **not** a security boundary for hostile binaries. Native commands inherit the runner's OS privileges and network reach. Use containers or stronger sandboxing for untrusted code.

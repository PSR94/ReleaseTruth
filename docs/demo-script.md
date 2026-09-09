# ReleaseTruth scripted demo

Run from a fresh clone:

```bash
make demo
```

The script builds the Rust workspace and TypeScript packages, builds TruthShop once, starts the `good` variant on port 3000 and the `regression` variant on port 3001, waits for both health surfaces, runs the same API/browser/accessibility/CLI/event/performance scenarios against each, finalizes both `behavior.lock.json` files through the Rust core, and generates text, JSON, Markdown, SARIF, and HTML reports.

The expected intentional signals include 400→422 API validation, native checkout button→non-keyboard clickable element, “Save Profile”→“Save”, a large search latency increase, confirmation dialog removal, webhook ordering reversal, CLI exit 0→1, cookie attribute change, and checkout layout change.

Outputs live under `.releasetruth/demo/`. They are generated artifacts, not committed fixtures, so the demo cannot silently pass using stale hardcoded comparison results.

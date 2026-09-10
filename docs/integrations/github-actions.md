# GitHub Actions integration

ReleaseTruth ships a composite GitHub Action in the repository root. It compares two already-captured behavior locks using the pinned Rust toolchain and deterministic core.

## Example

```yaml
name: behavioral-compatibility

on:
  pull_request:

jobs:
  releasetruth:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Produce or download behavior locks
        run: ./your-capture-step.sh
      - name: Compare behavior
        id: releasetruth
        uses: PSR94/ReleaseTruth@main
        with:
          base-lock: artifacts/base/behavior.lock.json
          candidate-lock: artifacts/candidate/behavior.lock.json
          config: .releasetruth.yml
          fail-on: breaking
          report-dir: .releasetruth/action
      - uses: github/codeql-action/upload-sarif@v4
        if: always()
        with:
          sarif_file: ${{ steps.releasetruth.outputs.report-sarif }}
```

For production, pin ReleaseTruth to an immutable released tag or commit SHA rather than a moving branch.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `base-lock` | yes | — | baseline `behavior.lock.json` path |
| `candidate-lock` | yes | — | candidate `behavior.lock.json` path |
| `config` | no | `.releasetruth.yml` | classification/scoring/normalization config |
| `fail-on` | no | `breaking` | `breaking`, `significant`, `minor`, or `never` |
| `report-dir` | no | `.releasetruth/action` | destination for generated reports |

## Outputs

- `report-json` — JSON comparison path
- `report-sarif` — SARIF comparison path

Markdown is also written to `report.md` and appended to `GITHUB_STEP_SUMMARY`.

## Behavior

The action intentionally renders JSON, Markdown and SARIF with `--fail-on never` first so evidence survives even when the compatibility gate should fail. The final compare invocation enforces the requested threshold and returns ReleaseTruth exit code `2` when the threshold is reached.

CI includes a self-hosted smoke job that runs `uses: ./` against an example lock and verifies the generated outputs are non-empty.

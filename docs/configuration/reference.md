# Configuration reference

ReleaseTruth reads `.releasetruth.yml` by default.

```yaml
normalization:
  defaults: true
  rules:
    - type: replace_regex
      pattern: "req_[A-Za-z0-9]+"
      replacement: "<REQUEST_ID>"
      scope: /surfaces/api
    - type: remove
      path: /surfaces/api/0/attributes/headers/date
    - type: sort_array
      path: /surfaces/api/0/attributes/body/tags

classification:
  performanceRegressionPercent: 25
  expectedChangeIds: []
  severityOverrides:
    /visibleText: minor

scoring:
  penalties:
    expected: 0
    minor: 1
    significant: 7
    breaking: 20
  surfaceWeights:
    api: 1
    accessibility: 1.25
    browser: 1
    cli: 1
    events: 0.75
    performance: 0.5
```

Array order is preserved unless `sort_array` explicitly opts one path out. Severity overrides are deterministic path-prefix rules, with the longest matching prefix winning. Accepted change IDs are classified as `expected` and keep their evidence while contributing zero score penalty.

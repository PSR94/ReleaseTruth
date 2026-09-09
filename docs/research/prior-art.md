# Prior art and differentiation

Research date: 2026-09-09.

ReleaseTruth deliberately combines ideas from several mature testing categories without treating any one of them as the whole product. Its differentiator is a **versioned, cross-surface runtime behavior contract** backed by deterministic observations and evidence.

| Project | What it does | Similarities | Differences | What ReleaseTruth deliberately does differently |
| --- | --- | --- | --- | --- |
| [oasdiff](https://github.com/oasdiff/oasdiff) | Diffs OpenAPI specifications and classifies breaking API changes. | Structured changes, rules, breaking-change reporting, CI use. | Primarily compares API descriptions/specifications rather than unified runtime observations. | Tests live behavior and stores runtime evidence across API, browser, CLI, accessibility, events, and performance in one contract. |
| [Pact](https://docs.pact.io/) | Consumer-driven contract testing for HTTP/message integrations. | Concrete interaction contracts, compatibility focus, replay against providers. | Contracts originate from consumer/provider test expectations and focus on integrations. | Captures externally observable release behavior even without a consumer-authored contract, and compares arbitrary releases. |
| [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) | Browser automation plus screenshot and snapshot comparison. | Browser journeys, screenshots, regression detection. | Primarily test-runner assertions and visual/text snapshots. | Promotes browser observations into one normalized behavioral model and correlates them with other surfaces/evidence. |
| [Argos](https://argos-ci.com/) / [BackstopJS](https://github.com/garris/BackstopJS) | Visual regression review and screenshot-baseline workflows. | Before/after evidence, baselines, acceptance flow. | Image-centric. | Treats screenshots as one evidence artifact among semantic DOM, accessibility, network, API, CLI, event, and timing observations. |
| [axe-core](https://github.com/dequelabs/axe-core) | Automated accessibility rules engine. | Accessibility evidence and regression inputs. | Reports accessibility violations for a state; it is not a cross-release behavioral history engine. | Stores accessibility semantics/violations as versioned observations and reports exactly what changed between releases. |
| [Schemathesis](https://schemathesis.readthedocs.io/) | Property-based API testing from OpenAPI/GraphQL schemas. | Runtime HTTP execution, status/schema validation, reproducible failures. | Generates API test cases to find defects rather than preserving a product-wide behavioral lock. | Uses scenario capture to compare releases; OpenAPI import is optional rather than the source of truth. |
| [snapbox](https://github.com/assert-rs/snapbox) / trycmd | Snapshot-oriented CLI stdout/stderr/filesystem testing. | CLI output and filesystem observations. | Focused on CLI test fixtures. | Sandboxes CLI scenarios and joins exit/output/filesystem diffs with the same cross-surface evidence and scoring model. |

## Design conclusions

1. ReleaseTruth must not become an OpenAPI diff wrapper; runtime behavior remains authoritative.
2. Screenshot diffs are useful but too noisy and narrow to define behavior alone.
3. Accessibility automation should reuse proven engines such as axe-core while preserving ReleaseTruth's own normalized evidence model.
4. The acceptance workflow should borrow the ergonomics of snapshot/visual review, but accepted changes become a new versioned behavioral baseline rather than silently overwriting evidence.
5. Rule coverage and deterministic fingerprints are essential for trustworthy CI output.

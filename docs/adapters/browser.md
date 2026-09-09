# Browser adapter

The browser adapter uses Playwright and a small declarative journey DSL. It captures significant interactive structure rather than blindly serializing the full DOM.

Supported steps in v0.1 are `goto`, `click`, `fill`, `press`, `waitFor`, and `expect` (URL substring, text, or visible selector). Failures identify the journey and step number.

Captured state includes final URL, normalized visible text, significant interactive DOM elements, cookie attributes with values redacted, localStorage keys (not values), console errors, network response metadata, current focus, and an optional full-page screenshot.

The adapter also invokes the accessibility adapter on the same final state. Browser rendering itself can be nondeterministic across operating systems and browser builds; run base/candidate captures in identical containers when visual evidence matters.

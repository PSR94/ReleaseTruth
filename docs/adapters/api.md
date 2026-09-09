# API adapter

The API adapter executes real HTTP requests against a target; OpenAPI is not required. A scenario specifies method, relative path, headers/body, timeout, and optional repeated sample count.

It captures status, response headers, content type, parsed JSON or text body, and timing samples. Authorization, Cookie, Set-Cookie, proxy authorization, and API-key headers are redacted by default. Additional header names can be configured for redaction.

Redirects are captured rather than automatically followed (`redirect: manual`) so redirect behavior remains observable.

Repeated samples produce min/max/mean/p50 and p95 when at least five samples exist. This is a lightweight release comparison signal, not a substitute for controlled load testing.

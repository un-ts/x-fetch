---
"x-fetch": minor
---

Rewrite with middleware-based architecture: rename `ApiInterceptor` to `XFetchMiddleware`, make `next()` request optional, add per-request middlewares, `XFetchError` with cross-realm `isXFetchError`, drop `cleanNilValues`.

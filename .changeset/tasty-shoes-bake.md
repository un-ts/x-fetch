---
"x-fetch": minor
---

Complete redesign from interceptor-based to middleware pipeline.

#### Breaking Changes

- **`ApiInterceptor`** → **`XFetchMiddleware`**
- **`interceptors`** → **`middlewares`** — `use()` / `eject()` API unchanged
- **`ResponseError`** → **`XFetchError`** — use `isXFetchError()` instead of `instanceof` for cross-realm safety
- **`createFetchApi` / `fetchApi`** → **`createXFetch` / `xfetch`**
- **`cleanNilValues`** is no longer exported (inlined into `normalizeUrl` internally). `null`/`undefined` query values are still omitted; empty strings are now preserved (matching `URLSearchParams` behavior).
- Middleware signature changed from `(req, next)` to `(ctx, next)`, where `ctx` is a **mutable** context object (`method`, `url`, ...). Middleware can override `ctx.json` (whether to JSON-stringify body) and `ctx.type` (response parsing) — the final context at the fetch leaf is authoritative.

#### New Features

- `next()` is optional — defaults to the previous context, enables clean retry: `try { await next() } catch { return next() }`
- Per-request `middlewares` option: `xfetch(url, { middlewares: [...] })`, composed as global → per-call → fetch
- Cross-realm error detection via `Symbol.for('x-fetch.error')` — `isXFetchError()` works across iframes / workers
- Consistent error wrapping: network failures, JSON parse errors, non-ok responses all wrapped as `XFetchError`

#### Migration

```diff
- import { createFetchApi, fetchApi, ResponseError } from 'x-fetch'
+ import { createXFetch, xfetch, isXFetchError } from 'x-fetch'
```

Before:

```ts
const interceptor: ApiInterceptor = (req, next) => {
  req.headers.set("Authorization", "Bearer token")
  return next(req)
}
interceptors.use(interceptor)
```

After:

```ts
const middleware: XFetchMiddleware = (ctx, next) => {
  ctx.headers.set("Authorization", "Bearer token")
  return next()
}
middlewares.use(middleware)
```

Retry with snapshot:

```ts
const retry: XFetchMiddleware = async (ctx, next) => {
  const snapshot = { ...ctx, headers: new Headers(ctx.headers) }
  try {
    return await next()
  } catch {
    return next(snapshot)
  }
}
```

Error handling:

```diff
  } catch (error) {
-   if (error instanceof ResponseError) { ... }
+   if (isXFetchError(error)) { ... }
  }
```

Per-request middlewares:

```ts
await xfetch("/api", { middlewares: [retry, withCache] })
```

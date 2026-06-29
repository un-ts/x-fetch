# Change Log

## 0.3.0

### Minor Changes

- [#49](https://github.com/un-ts/x-fetch/pull/49) [`96d49f8`](https://github.com/un-ts/x-fetch/commit/96d49f8cb036f9ded836fe16e48790d6e155ecdb) Thanks [@JounQin](https://github.com/JounQin)! - Complete redesign from interceptor-based to middleware pipeline.

  #### Breaking Changes
  - **`ApiInterceptor`** → **`XFetchMiddleware`**
  - **`interceptors`** → **`middlewares`** — `use()` / `eject()` API unchanged
  - **`ResponseError`** → **`XFetchError`** — use `isXFetchError()` instead of `instanceof` for cross-realm safety
  - **`createFetchApi` / `fetchApi`** → **`createXFetch` / `xfetch`**
  - **`cleanNilValues`** is no longer exported (inlined into `normalizeUrl` internally). `null`/`undefined` query values are still omitted; empty strings are now preserved (matching `URLSearchParams` behavior).
  - Middleware signature changed from `(req, next)` to `(ctx, next)`, where `ctx` is a **mutable** context object (`method`, `url`, ...). Middleware can override `ctx.type` (response parsing). JSON body serialization is auto-detected from `ctx.body` at the fetch leaf — the final context is authoritative.

  #### New Features
  - `next()` is optional — defaults to the previous context, enables clean retry: `try { await next() } catch { return next() }`
  - Per-request `middlewares` option: `xfetch(url, { middlewares: [...] })`, composed as global → per-call → fetch
  - Cross-realm error detection via `Symbol.for('x-fetch')` — `isXFetchError()` works across iframes / workers
  - Consistent error wrapping: network failures, JSON parse errors, non-ok responses all wrapped as `XFetchError`

  #### Migration

  ```diff
  - import { createFetchApi, fetchApi, ResponseError } from 'x-fetch'
  + import { createXFetch, xfetch, isXFetchError } from 'x-fetch'
  ```

  Before:

  ```ts
  const interceptor: ApiInterceptor = (req, next) => {
    req.headers.set('Authorization', 'Bearer token')
    return next(req)
  }
  interceptors.use(interceptor)
  ```

  After:

  ```ts
  const middleware: XFetchMiddleware = (ctx, next) => {
    ctx.headers.set('Authorization', 'Bearer token')
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
  await xfetch('/api', { middlewares: [retry, withCache] })
  ```

## 0.2.7

### Patch Changes

- [#45](https://github.com/un-ts/x-fetch/pull/45) [`d4c833d`](https://github.com/un-ts/x-fetch/commit/d4c833d0ad30c2955332449dabc73ba26445cc74) Thanks [@JounQin](https://github.com/JounQin)! - fix: allow `next()` to be called multiple times for request retry

- [#48](https://github.com/un-ts/x-fetch/pull/48) [`2e005ce`](https://github.com/un-ts/x-fetch/commit/2e005ce6623c209290b5468dfe17d26570fa7c91) Thanks [@JounQin](https://github.com/JounQin)! - Make `next()`'s `request` optional, defaults to the previous request when omitted.

## 0.2.6

### Patch Changes

- [#34](https://github.com/un-ts/x-fetch/pull/34) [`a933a8c`](https://github.com/un-ts/x-fetch/commit/a933a8c21209404d441910e6e2a88d6475388e1c) Thanks [@JounQin](https://github.com/JounQin)! - feat: rename `fetchApi` to `xfetch`

- [#32](https://github.com/un-ts/x-fetch/pull/32) [`cbbccf5`](https://github.com/un-ts/x-fetch/commit/cbbccf5d590e496b0747a606abb1b05a0147277f) Thanks [@JounQin](https://github.com/JounQin)! - feat: change `ResponseError` as `class` instead

## 0.2.5

### Patch Changes

- [#28](https://github.com/un-ts/x-fetch/pull/28) [`33629f4`](https://github.com/un-ts/x-fetch/commit/33629f4539d575bee69bc6c5732909c894dcea13) Thanks [@JounQin](https://github.com/JounQin)! - fix: drop `tslib` dependency for smaller size, it's less than `850B` minified and brotlied now!

## 0.2.4

### Patch Changes

- [`8861fbf`](https://github.com/un-ts/x-fetch/commit/8861fbf1eeb4c58258cba1a5c32638109d0f6a41) Thanks [@JounQin](https://github.com/JounQin)! - fix: incorrect typing for `cjs` entry

## 0.2.3

### Patch Changes

- [#18](https://github.com/un-ts/x-fetch/pull/18) [`d4e3c48`](https://github.com/un-ts/x-fetch/commit/d4e3c487f20fe9925c9c6a20f659f5076fe6eb41) Thanks [@JounQin](https://github.com/JounQin)! - fix: allow more methods to use used

## 0.2.2

### Patch Changes

- [#16](https://github.com/un-ts/x-fetch/pull/16) [`90b5813`](https://github.com/un-ts/x-fetch/commit/90b581321300592fe926b54bbe163cf4b2843a03) Thanks [@JounQin](https://github.com/JounQin)! - fix: should await data, add request into error

## 0.2.1

### Patch Changes

- [#14](https://github.com/un-ts/x-fetch/pull/14) [`5e1cd70`](https://github.com/un-ts/x-fetch/commit/5e1cd7095613a1d1374d5af8fbd9bd092964ed8e) Thanks [@JounQin](https://github.com/JounQin)! - fix: only fallback to text on error

## 0.2.0

### Minor Changes

- [#11](https://github.com/un-ts/x-fetch/pull/11) [`62435b7`](https://github.com/un-ts/x-fetch/commit/62435b78b8644f67c9bb670d23afaf3a101dac25) Thanks [@JounQin](https://github.com/JounQin)! - feat: add extractDataFromResponse util for better data from response

## 0.1.3

### Patch Changes

- [#8](https://github.com/un-ts/x-fetch/pull/8) [`5d91037`](https://github.com/un-ts/x-fetch/commit/5d910377e1deb3494e29e9a3b04591e680de6f78) Thanks [@JounQin](https://github.com/JounQin)! - fix: known typings issue of `type` field

## 0.1.2

### Patch Changes

- [#6](https://github.com/un-ts/x-fetch/pull/6) [`a999555`](https://github.com/un-ts/x-fetch/commit/a999555174a0d255d35ccea3a161cfcd78f757fa) Thanks [@JounQin](https://github.com/JounQin)! - fix: unexpected incorrect entries

## 0.1.1

### Patch Changes

- [#4](https://github.com/un-ts/x-fetch/pull/4) [`6ec2e00`](https://github.com/un-ts/x-fetch/commit/6ec2e00d4b81aad01023ef56f3a8fc4a5b067489) Thanks [@JounQin](https://github.com/JounQin)! - fix: unexpected incorrect entries

# x-fetch

[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/un-ts/x-fetch/ci.yml?branch=main)](https://github.com/un-ts/x-fetch/actions/workflows/ci.yml?query=branch%3Amain)
[![Codecov](https://img.shields.io/codecov/c/github/un-ts/x-fetch.svg)](https://codecov.io/gh/un-ts/x-fetch)
[![type-coverage](https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Fun-ts%2Fx-fetch%2Fmain%2Fpackage.json)](https://github.com/plantain-00/type-coverage)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/un-ts/x-fetch)](https://coderabbit.ai)
[![npm](https://img.shields.io/npm/v/x-fetch.svg)](https://www.npmjs.com/package/x-fetch)
[![GitHub Release](https://img.shields.io/github/release/un-ts/x-fetch)](https://github.com/un-ts/x-fetch/releases)

[![Conventional Commits](https://img.shields.io/badge/conventional%20commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![changesets](https://img.shields.io/badge/maintained%20with-changesets-176de3.svg)](https://github.com/changesets/changesets)

A simple but elegant `fetch` API wrapper with less than `850B` minified and brotlied, use `fetch` like a charm

## TOC <!-- omit in toc -->

- [Usage](#usage)
  - [Install](#install)
  - [API](#api)
  - [Migration Guides](#migration-guides)
- [Sponsors and Backers](#sponsors-and-backers)
  - [Sponsors](#sponsors)
  - [Backers](#backers)
- [Changelog](#changelog)
- [License](#license)

## Usage

### Install

```sh
# npm
npm i x-fetch

# yarn
yarn add x-fetch

# pnpm
pnpm add x-fetch

# bun
bun add x-fetch
```

### API

```ts
import {
  HttpMethod,
  createXFetch,
  isXFetchError,
  xfetch,
  middlewares,
  type XFetchMiddleware,
} from 'x-fetch'

// plain url, GET method, returns JSON
await xfetch('url')

// with options — method, body, query, headers, etc.
await xfetch('url', {
  method: HttpMethod.POST, // or 'POST'
  // plain object or array (auto JSON-stringified), or BodyInit
  body: {},
  // URLSearchParams-compatible query object
  query: {
    key: 'value',
  },
  // json: true, // auto (default for plain objects/arrays), set false to disable
  // type: 'arrayBuffer' | 'blob' | 'json' | 'text' | null, // defaults to 'json'
})

// --- Middlewares ---

const middleware: XFetchMiddleware = async (ctx, next) => {
  // mutate ctx before the request
  ctx.headers.set('Authorization', 'Bearer token')
  const res = await next() // same as next(ctx)
  // mutate / inspect the response
  return res
}

// global — applies to all xfetch calls
middlewares.use(middleware)
middlewares.eject(middleware)

// per-call — merged with global middlewares (global → per-call → fetch)
await xfetch('url', { middlewares: [middleware] })

// ctx is mutable — middleware can override json, type, url, etc.
const forceText: XFetchMiddleware = async (ctx, next) => {
  ctx.json = false
  ctx.type = 'text'
  return next()
}

// --- Common recipes ---

// Base URL
const withBaseUrl: XFetchMiddleware = async (ctx, next) => {
  ctx.url = new URL(ctx.url, 'https://api.example.com').href
  return next()
}

// Retry
const retry: XFetchMiddleware = async (ctx, next) => {
  try {
    return await next()
  } catch {
    return next() // reuses ctx, mutations from failed attempt persist
  }
}

// Retry with snapshot — restore original context on retry
const retryWithSnapshot: XFetchMiddleware = async (ctx, next) => {
  const snapshot = { ...ctx, headers: new Headers(ctx.headers) }
  try {
    return await next()
  } catch {
    return next(snapshot) // fresh context, no leaked mutations
  }
}

// Timeout
const withTimeout: XFetchMiddleware = async (ctx, next) => {
  ctx.signal = AbortSignal.timeout(5000)
  return next()
}

// Cache
const cache = new Map<string, Response>()
const withCache: XFetchMiddleware = async (ctx, next) => {
  const key = ctx.url
  if (cache.has(key)) {
    return cache.get(key)!.clone()
  }
  const res = await next()
  cache.set(key, res.clone())
  return res
}

// Upload / download progress — extend context with custom callbacks
declare module 'x-fetch' {
  interface XFetchMiddlewareContext {
    onUploadProgress?: (loaded: number, total: number) => void
    onDownloadProgress?: (loaded: number, total: number) => void
  }
}

const trackProgress = (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  total: number,
  onProgress: (loaded: number, total: number) => void,
) =>
  new ReadableStream({
    start(controller) {
      let loaded = 0
      function pump() {
        reader.read().then(
          ({ done, value }) => {
            if (done) {
              controller.close()
              return
            }
            loaded += value!.length
            onProgress(loaded, total)
            controller.enqueue(value!)
            pump()
          },
          err => controller.error(err),
        )
      }
      pump()
    },
  })

const withUploadProgress: XFetchMiddleware = async (ctx, next) => {
  if (ctx.onUploadProgress && ctx.body instanceof ReadableStream) {
    const total = Number(ctx.headers.get('Content-Length') || 0)
    ctx.body = trackProgress(ctx.body.getReader(), total, ctx.onUploadProgress)
  }
  return next()
}

const withDownloadProgress: XFetchMiddleware = async (ctx, next) => {
  if (!ctx.onDownloadProgress) {
    return next()
  }
  const res = await next()
  const reader = res.clone().body?.getReader()
  if (!reader) {
    return res
  }
  const total = Number(res.headers.get('Content-Length') || 0)
  return new Response(trackProgress(reader, total, ctx.onDownloadProgress), res)
}

await xfetch('/api', {
  onUploadProgress: (loaded, total) => console.log(`↑ ${loaded}/${total}`),
  middlewares: [withUploadProgress],
})

// XHR-based fetch — native progress via init callbacks
declare global {
  interface RequestInit {
    onUploadProgress?: (loaded: number, total: number) => void
    onDownloadProgress?: (loaded: number, total: number) => void
  }
}

const xhrFetch: typeof fetch = (input, init) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const url = input instanceof Request ? input.url : String(input)
    xhr.open(init?.method || 'GET', url)
    new Headers(init?.headers).forEach((v, k) => xhr.setRequestHeader(k, v))
    const { onUploadProgress, onDownloadProgress, signal, ...rest } = init || {}
    xhr.upload.onprogress = e => onUploadProgress?.(e.loaded, e.total)
    xhr.onprogress = e => onDownloadProgress?.(e.loaded, e.total)
    signal?.addEventListener('abort', () => xhr.abort())
    xhr.onload = () =>
      resolve(
        new Response(xhr.response, {
          status: xhr.status,
          statusText: xhr.statusText,
        }),
      )
    xhr.onerror = () => reject(new Error('XHR failed'))
    xhr.send((rest as RequestInit).body as XMLHttpRequestBodyInit)
  })

const { xfetch } = createXFetch(xhrFetch)

await xfetch('/file', {
  onUploadProgress: (loaded, total) => console.log(`↑ ${loaded}/${total}`),
  onDownloadProgress: (loaded, total) => console.log(`↓ ${loaded}/${total}`),
})

// or — middleware that bypasses next() for native XHR progress events
const withXhrProgress: XFetchMiddleware = (ctx, next) =>
  !ctx.onUploadProgress && !ctx.onDownloadProgress
    ? next()
    : new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open(ctx.method, ctx.url)
        ctx.headers.forEach((v, k) => xhr.setRequestHeader(k, v))
        xhr.upload.onprogress = e => ctx.onUploadProgress?.(e.loaded, e.total)
        xhr.onprogress = e => ctx.onDownloadProgress?.(e.loaded, e.total)
        xhr.onload = () =>
          resolve(
            new Response(xhr.response, {
              status: xhr.status,
              statusText: xhr.statusText,
            }),
          )
        xhr.onerror = () => reject(new Error('XHR failed'))
        xhr.send(ctx.body as XMLHttpRequestBodyInit)
      })

await xfetch('/upload', {
  onUploadProgress: (loaded, total) => console.log(`${loaded}/${total}`),
  middlewares: [retry, withXhrProgress], // withXhrProgress last — innermost
})

// next() always throws XFetchError, inspect and handle in middleware
const withFallback: XFetchMiddleware = async (ctx, next) => {
  try {
    return await next()
  } catch (error) {
    if (isXFetchError(error) && error.response?.status === 404) {
      return new Response('{"error":"not found"}', { status: 200 })
    }
    throw error
  }
}

// call site — non-HTTP errors are also wrapped as XFetchError
try {
  await xfetch('url')
} catch (error) {
  if (isXFetchError(error)) {
    console.error(error.message, error.response?.status, error.data)
  }
}

// --- Isolated instance ---

const { xfetch, middlewares } = createXFetch() // or createXFetch(customFetch)
```

### Migration Guides

#### From axios

```ts
// axios
const { data } = await axios.get('/users', { params: { page: 1 } })
await axios.post('/users', { name: 'John' })

// x-fetch
const data = await xfetch('/users?page=1')
await xfetch('/users', { method: 'POST', body: { name: 'John' } })
```

| axios                               | x-fetch                        |
| ----------------------------------- | ------------------------------ |
| `axios.create({ baseURL })`         | `middlewares.use(withBaseUrl)` |
| `axios.interceptors.request.use()`  | `middlewares.use()`            |
| `axios.interceptors.response.use()` | `middlewares.use()`            |
| `error.response?.status`            | `error.response?.status`       |

#### From ky

```ts
// ky
await ky.get('/users', { searchParams: { page: 1 } }).json()
await ky.post('/users', { json: { name: 'John' } })

// x-fetch
await xfetch('/users', { query: { page: 1 } })
await xfetch('/users', { method: 'POST', body: { name: 'John' } })
```

| ky                         | x-fetch                                   |
| -------------------------- | ----------------------------------------- |
| `ky.create({ prefixUrl })` | `middlewares.use(withBaseUrl)`            |
| `ky.extend({ hooks })`     | `createXFetch()` with `middlewares.use()` |
| `HTTPError`                | `XFetchError`                             |

#### From ofetch

```ts
// ofetch
await $fetch('/users', { query: { page: 1 } })
const api = $fetch.create({ baseURL: 'https://api.example.com' })

// x-fetch
await xfetch('/users', { query: { page: 1 } })
const { xfetch, middlewares } = createXFetch()
middlewares.use(withBaseUrl)
await xfetch('/users', { query: { page: 1 } })
```

| ofetch                               | x-fetch                        |
| ------------------------------------ | ------------------------------ |
| `$fetch.create({ baseURL })`         | `middlewares.use(withBaseUrl)` |
| `$fetch.create({ onRequest })`       | `middlewares.use()`            |
| `$fetch.create({ onResponse })`      | `middlewares.use()`            |
| `$fetch.create({ onResponseError })` | try/catch in middleware        |

## Sponsors and Backers

[![Sponsors and Backers](https://raw.githubusercontent.com/1stG/static/master/sponsors.svg)](https://github.com/sponsors/JounQin)

### Sponsors

| 1stG                                                                                                                   | RxTS                                                                                                                   | UnTS                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective sponsors](https://opencollective.com/1stG/organizations.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective sponsors](https://opencollective.com/rxts/organizations.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective sponsors](https://opencollective.com/unts/organizations.svg)](https://opencollective.com/unts) |

### Backers

| 1stG                                                                                                                | RxTS                                                                                                                | UnTS                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective backers](https://opencollective.com/1stG/individuals.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective backers](https://opencollective.com/rxts/individuals.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective backers](https://opencollective.com/unts/individuals.svg)](https://opencollective.com/unts) |

## Changelog

Detailed changes for each release are documented in [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT][] © [JounQin][]@[1stG.me][]

[1stG.me]: https://www.1stG.me
[JounQin]: https://github.com/JounQin
[MIT]: http://opensource.org/licenses/MIT

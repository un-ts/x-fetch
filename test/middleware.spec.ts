/* eslint-disable @typescript-eslint/require-await, sonarjs/no-identical-functions, vitest/no-conditional-expect */

import { createXFetch, isXFetchError, type XFetchMiddleware } from 'x-fetch'

const mockOk = () =>
  Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))

test('next() can be called multiple times for retry', async () => {
  let fetchCalls = 0

  const mockFetch = () => {
    fetchCalls++
    if (fetchCalls <= 1) {
      return Promise.resolve(new Response(null, { status: 500 }))
    }
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
  }

  const { middlewares, xfetch } = createXFetch(mockFetch)

  const retryInterceptor: XFetchMiddleware = async (_req, next) => {
    try {
      return await next()
    } catch {
      return next()
    }
  }

  middlewares.use(retryInterceptor)

  const data = await xfetch<{ ok: boolean }>('https://example.com')
  expect(data).toEqual({ ok: true })
  expect(fetchCalls).toBe(2)
})

test('middleware can modify request between retries', async () => {
  const requests: Array<string | null> = []

  const mockFetch = (_url: RequestInfo | URL, init?: RequestInit) => {
    const auth = (init!.headers as Headers).get('Authorization')
    requests.push(auth)
    if (!auth) {
      return Promise.resolve(new Response(null, { status: 401 }))
    }
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
  }

  const { middlewares, xfetch } = createXFetch(mockFetch)

  const authRetryMiddleware: XFetchMiddleware = async (req, next) => {
    try {
      return await next()
    } catch {
      req.headers.set('Authorization', 'Bearer token')
      return next()
    }
  }

  middlewares.use(authRetryMiddleware)

  const data = await xfetch<{ ok: boolean }>('https://example.com')
  expect(data).toEqual({ ok: true })
  expect(requests).toEqual([null, 'Bearer token'])
})

test('per-request middlewares', async () => {
  const callOrder: string[] = []

  const mockFetch = () => {
    callOrder.push('fetch')
    return mockOk()
  }

  const { xfetch } = createXFetch(mockFetch)

  const perCall: XFetchMiddleware = async (_req, next) => {
    callOrder.push('per-call')
    return next()
  }

  await xfetch('https://example.com', { middlewares: [perCall] })
  expect(callOrder).toEqual(['per-call', 'fetch'])
})

test('middleware can prepend base url', async () => {
  let fetchedUrl = ''

  const mockFetch = async (input: RequestInfo | URL) => {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    fetchedUrl = String(input)
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  const { middlewares, xfetch } = createXFetch(mockFetch)

  const baseUrl: XFetchMiddleware = async (ctx, next) => {
    ctx.url = new URL(ctx.url, 'https://api.example.com').href
    return next()
  }

  middlewares.use(baseUrl)

  await xfetch('/users')
  expect(fetchedUrl).toBe('https://api.example.com/users')
})

test('middleware catches XFetchError from next()', async () => {
  const mockFetch = async () =>
    new Response(null, { status: 404, statusText: 'Not Found' })

  const { middlewares, xfetch } = createXFetch(mockFetch)

  const fallback: XFetchMiddleware = async (_ctx, next) => {
    try {
      return await next()
    } catch (error) {
      if (!isXFetchError(error)) {
        throw error
      }
      return new Response('{"ok":false}', { status: 200 })
    }
  }

  middlewares.use(fallback)

  const data = await xfetch<{ ok: boolean }>('https://example.com')
  expect(data).toEqual({ ok: false })
})

test('global + per-call middlewares compose correctly', async () => {
  const callOrder: string[] = []

  const mockFetch = () => {
    callOrder.push('fetch')
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
  }

  const { middlewares, xfetch } = createXFetch(mockFetch)

  const global: XFetchMiddleware = async (_ctx, next) => {
    callOrder.push('global-in')
    const res = await next()
    callOrder.push('global-out')
    return res
  }

  const perCall: XFetchMiddleware = async (_ctx, next) => {
    callOrder.push('per-call-in')
    const res = await next()
    callOrder.push('per-call-out')
    return res
  }

  middlewares.use(global)

  await xfetch('https://example.com', { middlewares: [perCall] })
  expect(callOrder).toEqual([
    'global-in',
    'per-call-in',
    'fetch',
    'per-call-out',
    'global-out',
  ])
})

test('XFetchError wraps network failure', async () => {
  const mockFetch = async () => {
    throw new TypeError('fetch failed')
  }

  const { xfetch } = createXFetch(mockFetch)

  try {
    await xfetch('https://example.com')
  } catch (error) {
    if (!isXFetchError(error)) {
      throw error
    }
    expect(error.context.url).toBe('https://example.com')
    expect(error.cause).toBeInstanceOf(TypeError)
    expect(error.message).toBe('fetch failed')
  }
})

test('multiple middlewares work correctly', async () => {
  const callOrder: string[] = []

  const mockFetch = () => {
    callOrder.push('fetch')
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
  }

  const { middlewares, xfetch } = createXFetch(mockFetch)

  const a: XFetchMiddleware = async (_req, next) => {
    callOrder.push('a-in')
    const res = await next()
    callOrder.push('a-out')
    return res
  }

  const b: XFetchMiddleware = async (_req, next) => {
    callOrder.push('b-in')
    const res = await next()
    callOrder.push('b-out')
    return res
  }

  middlewares.use(a, b)

  await xfetch('https://example.com')
  expect(callOrder).toEqual(['a-in', 'b-in', 'fetch', 'b-out', 'a-out'])
})

test('middleware can override json and type', async () => {
  let receivedBody = ''

  const mockFetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    receivedBody = (init?.body as string) || ''
    return new Response(receivedBody, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const { middlewares, xfetch } = createXFetch(mockFetch)

  const override: XFetchMiddleware = async (ctx, next) => {
    ctx.type = 'text'
    return next()
  }

  middlewares.use(override)

  const data = await xfetch('https://example.com', {
    method: 'POST',
    body: 'raw-string',
  })

  expect(receivedBody).toBe('raw-string')
  expect(data).toBe('raw-string')
})

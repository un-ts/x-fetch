import { createXFetch, type ApiInterceptor } from 'x-fetch'

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

  const { interceptors, xfetch } = createXFetch(mockFetch)

  const retryInterceptor: ApiInterceptor = async (req, next) => {
    try {
      return await next(req)
    } catch {
      return next(req)
    }
  }

  interceptors.use(retryInterceptor)

  const data = await xfetch<{ ok: boolean }>('https://example.com')
  expect(data).toEqual({ ok: true })
  expect(fetchCalls).toBe(2)
})

test('interceptor can modify request between retries', async () => {
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

  const { interceptors, xfetch } = createXFetch(mockFetch)

  const authRetryInterceptor: ApiInterceptor = async (req, next) => {
    try {
      return await next(req)
    } catch {
      req.headers.set('Authorization', 'Bearer token')
      return next(req)
    }
  }

  interceptors.use(authRetryInterceptor)

  const data = await xfetch<{ ok: boolean }>('https://example.com')
  expect(data).toEqual({ ok: true })
  expect(requests).toEqual([null, 'Bearer token'])
})

test('multiple interceptors work correctly', async () => {
  const callOrder: string[] = []

  const mockFetch = () => {
    callOrder.push('fetch')
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
  }

  const { interceptors, xfetch } = createXFetch(mockFetch)

  const a: ApiInterceptor = async (req, next) => {
    callOrder.push('a-in')
    const res = await next(req)
    callOrder.push('a-out')
    return res
  }

  const b: ApiInterceptor = async (req, next) => {
    callOrder.push('b-in')
    const res = await next(req)
    callOrder.push('b-out')
    return res
  }

  interceptors.use(a, b)

  await xfetch('https://example.com')
  expect(callOrder).toEqual(['a-in', 'b-in', 'fetch', 'b-out', 'a-out'])
})

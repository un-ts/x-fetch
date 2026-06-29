/* eslint-disable @typescript-eslint/no-magic-numbers, @typescript-eslint/require-await, vitest/no-conditional-expect */

import {
  createXFetch,
  isXFetchError,
  middlewares,
  xfetch,
  type Nullable,
  type XFetchMiddleware,
} from 'x-fetch'

test('it should just work', async () => {
  expect(
    await xfetch<{
      id: number
      userId: number
    }>('https://jsonplaceholder.typicode.com/todos/1'),
  ).toMatchInlineSnapshot(`
    {
      "completed": false,
      "id": 1,
      "title": "delectus aut autem",
      "userId": 1,
    }
  `)
})

test('middlewares should just work', async () => {
  const middleware: XFetchMiddleware = (req, next) => {
    if (!/^https?:\/\//.test(req.url)) {
      req.url =
        'https://jsonplaceholder.typicode.com' +
        (req.url.startsWith('/') ? '' : '/') +
        req.url
    }
    return next(req)
  }

  await expect(xfetch('/todos/1')).rejects.toThrowErrorMatchingInlineSnapshot(
    '[Error: Failed to parse URL from /todos/1]',
  )

  middlewares.use(middleware)

  expect(
    await xfetch<{
      id: number
      userId: number
    }>('todos/1'),
  ).toMatchInlineSnapshot(`
    {
      "completed": false,
      "id": 1,
      "title": "delectus aut autem",
      "userId": 1,
    }
  `)

  expect(middlewares.eject(middleware)).toBe(true)
  expect(middlewares.eject(middleware)).toBe(false)

  await expect(xfetch('/todos/1')).rejects.toThrowErrorMatchingInlineSnapshot(
    '[Error: Failed to parse URL from /todos/1]',
  )
})

test('type: null returns raw Response', async () => {
  const mockFetch = async () =>
    new Response('ok', { status: 200, statusText: 'OK' })

  const { xfetch } = createXFetch(mockFetch)

  const res = await xfetch('https://example.com', { type: null })
  expect(res).toBeInstanceOf(Response)
  expect(res.status).toBe(200)
})

test('XFetchError on malformed JSON response', async () => {
  const mockFetch = async () =>
    new Response('not-json', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  const { xfetch } = createXFetch(mockFetch)

  try {
    await xfetch('https://example.com')
  } catch (error) {
    if (!isXFetchError(error)) {
      throw error
    }
    expect(error.response).toBeDefined()
    expect(error.response!.status).toBe(200)
    expect(error.cause).toBeInstanceOf(SyntaxError)
  }
})

test('auto JSON-stringifies plain object body', async () => {
  let body: Nullable<BodyInit>

  const mockFetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    body = init?.body
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  const { xfetch } = createXFetch(mockFetch)

  await xfetch('https://example.com', {
    method: 'POST',
    body: { foo: 'bar' },
  })

  expect(body).toBe('{"foo":"bar"}')
})

test('with json: false does not stringify body', async () => {
  let body: Nullable<BodyInit>

  const mockFetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    body = init?.body
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  const { xfetch } = createXFetch(mockFetch)

  await xfetch('https://example.com', {
    method: 'POST',
    body: '{"foo":"bar"}',
  })

  expect(body).toBe('{"foo":"bar"}')
})

test('auto JSON-stringifies array body', async () => {
  let contentType = ''
  let body: Nullable<BodyInit>

  const mockFetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    contentType = (init!.headers as Headers).get('Content-Type')!
    body = init?.body
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  const { xfetch } = createXFetch(mockFetch)

  await xfetch('https://example.com', {
    method: 'POST',
    body: ['a', 'b'],
  })

  expect(contentType).toBe('application/json')
  expect(body).toBe('["a","b"]')
})

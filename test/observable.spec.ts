/* eslint-disable @typescript-eslint/no-magic-numbers, @typescript-eslint/require-await, vitest/no-conditional-expect */

import { from, lastValueFrom, toArray } from 'rxjs'

import {
  createObservableXFetch,
  createXFetch,
  isXFetchError,
  observableXFetch,
  xfetch,
  type XFetchMiddleware,
  type XFetchObservable,
} from 'x-fetch/observable'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

const collect = <T>(source: XFetchObservable<T>) =>
  new Promise<{ values: T[]; completed: boolean }>((resolve, reject) => {
    const values: T[] = []
    source.subscribe({
      next(value) {
        values.push(value)
      },
      error: reject,
      complete() {
        resolve({ values, completed: true })
      },
    })
  })

// --- fixtures: streaming is user land, not library code ---

interface SSEMessage {
  data: string
  event?: string
  id?: string
}

const FRAME_BREAK = /\r?\n\r?\n/

/** Parses one SSE frame — `undefined` for comments and keep-alives. */
const parseFrame = (frame: string): SSEMessage | undefined => {
  const data: string[] = []
  let event: string | undefined
  let id: string | undefined
  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) {
      continue
    }
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    const value = (colon === -1 ? '' : line.slice(colon + 1)).replace(/^ /, '')
    switch (field) {
      case 'data': {
        data.push(value)

        break
      }
      case 'event': {
        event = value

        break
      }
      case 'id': {
        id = value

        break
      }
      // No default
    }
  }
  if (data.length === 0) {
    return
  }
  const message: SSEMessage = { data: data.join('\n') }
  if (event) {
    message.event = event
  }
  if (id) {
    message.id = id
  }
  return message
}

const sseResponse = (...chunks: string[]) => {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  )
}

/** The README recipe: one emitted value per Server-Sent Events frame. */
const withSSE: XFetchMiddleware = async (ctx, next) => {
  // the body is consumed here, so the outer `xfetch` must not parse it
  ctx.type = null
  const response = await next()
  const { body } = response
  if (!body) {
    return response
  }
  const reader = body.getReader()
  ctx.signal?.addEventListener('abort', () => {
    void reader.cancel()
  })
  const decoder = new TextDecoder()
  let buffer = ''
  const flush = (frame: string) => {
    const message = parseFrame(frame)
    if (message) {
      ctx.emit?.(message)
    }
  }
  for (;;) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    let match = FRAME_BREAK.exec(buffer)
    while (match) {
      flush(buffer.slice(0, match.index))
      buffer = buffer.slice(match.index + match[0].length)
      match = FRAME_BREAK.exec(buffer)
    }
  }
  buffer += decoder.decode()
  if (buffer.trim()) {
    // the last frame without a trailing blank line
    flush(buffer)
  }
  return response
}

test('xfetch() returns an observable of the parsed value', async () => {
  const { xfetch: request } = createXFetch(
    async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  )

  const { values, completed } = await collect(
    request<{ ok: boolean }>('https://example.com'),
  )

  expect(values).toEqual([{ ok: true }])
  expect(completed).toBe(true)
})

test('the default instance is observable-backed', () => {
  // cold — nothing is requested until it is subscribed
  const source = xfetch<{ id: number }>('https://example.com')

  expect(source['@@observable']()).toBe(source)
  expect(typeof source.subscribe).toBe('function')
})

test('global middlewares already have emit and signal on the context', async () => {
  const { middlewares, xfetch: request } = createXFetch(
    async () => new Response('{}', { status: 200 }),
  )

  const seen: string[] = []
  let hasSignal = false

  middlewares.use(async (ctx, next) => {
    seen.push(typeof ctx.emit)
    hasSignal = ctx.signal instanceof AbortSignal
    ctx.emit?.('from-global')
    return next()
  })

  const { values } = await collect(request('https://example.com'))

  expect(seen).toEqual(['function'])
  expect(hasSignal).toBe(true)
  expect(values).toEqual(['from-global'])
})

test('a caller abort still cancels a stream whose headers already arrived', async () => {
  const caller = new AbortController()
  const encoder = new TextEncoder()
  let cancelled = false

  const { xfetch: request } = createXFetch(
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('data: one\n\n'))
            // left open on purpose — the body is still being read
          },
          cancel() {
            cancelled = true
          },
        }),
        { status: 200 },
      ),
  )

  const values: unknown[] = []

  const subscription = request('https://example.com', {
    middlewares: [withSSE],
    signal: caller.signal,
  }).subscribe({
    next(value) {
      values.push(value)
    },
  })

  await tick()
  expect(values).toEqual([{ data: 'one' }])
  expect(cancelled).toBe(false)

  // the headers are long gone, the body is still open
  caller.abort()
  await tick()
  expect(cancelled).toBe(true)

  subscription.unsubscribe()
})

test('accepts a next callback directly', async () => {
  const { xfetch: request } = createXFetch(
    async () => new Response('"hello"', { status: 200 }),
  )

  const values: string[] = []

  await new Promise<void>(resolve => {
    request<string>('https://example.com').subscribe(value => {
      values.push(value)
      resolve()
    })
  })

  expect(values).toEqual(['hello'])
})

test('is cold and lazy — one request per subscription', async () => {
  let calls = 0

  const { xfetch: request } = createXFetch(async () => {
    calls++
    return new Response('{}', { status: 200 })
  })

  const source = request('https://example.com')

  expect(calls).toBe(0)

  await collect(source)
  expect(calls).toBe(1)

  await collect(source)
  expect(calls).toBe(2)
})

test('respects the type option', async () => {
  const { xfetch: request } = createXFetch(
    async () => new Response('hello', { status: 200 }),
  )

  expect(
    await lastValueFrom(from(request('https://example.com', { type: 'text' }))),
  ).toBe('hello')

  const response = await lastValueFrom(
    from(request('https://example.com', { type: null })),
  )
  expect(response).toBeInstanceOf(Response)
  expect(response.status).toBe(200)
})

test('emits an XFetchError carrying the parsed data', async () => {
  const { xfetch: request } = createXFetch(
    async () =>
      new Response(JSON.stringify({ message: 'nope' }), { status: 500 }),
  )

  const error = await new Promise<unknown>(resolve => {
    request('https://example.com').subscribe({
      error: resolve,
    })
  })

  expect(isXFetchError(error)).toBe(true)

  if (!isXFetchError(error)) {
    throw error
  }

  expect(error.message).toBe('500')
  expect(error.response?.status).toBe(500)
  expect(error.data).toEqual({ message: 'nope' })
})

test('runs through the middleware chain', async () => {
  const order: string[] = []
  let fetchedUrl = ''

  const mockFetch = async (input: RequestInfo | URL) => {
    order.push('fetch')
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    fetchedUrl = String(input)
    return new Response('{}', { status: 200 })
  }

  const { middlewares, xfetch: request } = createXFetch(mockFetch)

  const baseUrl: XFetchMiddleware = async (ctx, next) => {
    order.push('global')
    ctx.url = new URL(ctx.url, 'https://api.example.com').href
    return next()
  }

  const perCall: XFetchMiddleware = async (_ctx, next) => {
    order.push('per-call')
    return next()
  }

  middlewares.use(baseUrl)

  await collect(request('/users', { middlewares: [perCall] }))

  expect(fetchedUrl).toBe('https://api.example.com/users')
  expect(order).toEqual(['global', 'per-call', 'fetch'])
})

test('unsubscribe aborts the in-flight request', async () => {
  let signal: AbortSignal | undefined

  const { xfetch: request } = createXFetch(
    (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        signal = init?.signal ?? undefined
        signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        })
      }),
  )

  const errors: unknown[] = []

  const subscription = request('https://example.com').subscribe({
    error(error) {
      errors.push(error)
    },
  })

  await tick()
  expect(signal?.aborted).toBe(false)
  expect(subscription.closed).toBe(false)

  subscription.unsubscribe()
  expect(signal?.aborted).toBe(true)
  expect(subscription.closed).toBe(true)

  await tick()
  // the observer is closed, the abort is not reported as an error
  expect(errors).toEqual([])
})

test('cascades the caller signal into the request', async () => {
  const caller = new AbortController()

  const { xfetch: request } = createXFetch(
    (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        })
      }),
  )

  const errors: unknown[] = []

  request('https://example.com', { signal: caller.signal }).subscribe({
    error(error) {
      errors.push(error)
    },
  })

  await tick()
  caller.abort()
  await tick()

  expect(errors).toHaveLength(1)
  expect(isXFetchError(errors[0])).toBe(true)
})

test('honours a caller signal which is already aborted', async () => {
  const caller = new AbortController()
  caller.abort()

  const { xfetch: request } = createXFetch(
    (_url: RequestInfo | URL, init?: RequestInit) =>
      init?.signal?.aborted
        ? Promise.reject(new DOMException('aborted', 'AbortError'))
        : Promise.resolve(new Response('{}', { status: 200 })),
  )

  const errors: unknown[] = []

  request('https://example.com', { signal: caller.signal }).subscribe({
    error(error) {
      errors.push(error)
    },
  })

  await tick()

  expect(errors).toHaveLength(1)
  expect(isXFetchError(errors[0])).toBe(true)
})

test('middlewares can push several values with ctx.emit()', async () => {
  const { xfetch: request } = createXFetch(
    async () => new Response('{"ok":true}', { status: 200 }),
  )

  const withEvents: XFetchMiddleware = async (ctx, next) => {
    const response = await next()
    ctx.emit?.('first')
    ctx.emit?.('second')
    return response
  }

  const { values, completed } = await collect(
    request('https://example.com', { middlewares: [withEvents] }),
  )

  // the resolved value is not emitted again once a middleware emitted
  expect(values).toEqual(['first', 'second'])
  expect(completed).toBe(true)
})

test('streams one value per SSE frame', async () => {
  // the second frame is split across two chunks on purpose
  const { xfetch: request } = createXFetch(async () =>
    sseResponse(
      'data: first\n\n',
      'event: delta\ndata: sec',
      'ond\nid: 42\n\n: keep-alive\n\n',
      'data: {"n":3}\n\n',
    ),
  )

  const { values, completed } = await collect(
    request<SSEMessage>('https://example.com', { middlewares: [withSSE] }),
  )

  expect(values).toEqual([
    { data: 'first' },
    { data: 'second', event: 'delta', id: '42' },
    { data: '{"n":3}' },
  ])
  expect(completed).toBe(true)
})

test('unsubscribe cancels an open stream', async () => {
  const encoder = new TextEncoder()
  let cancelled = false

  const { xfetch: request } = createXFetch(
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode('data: one\n\n'))
            // intentionally left open — the server keeps the connection alive
          },
          cancel() {
            cancelled = true
          },
        }),
        { status: 200 },
      ),
  )

  const values: unknown[] = []

  const subscription = request('https://example.com', {
    middlewares: [withSSE],
  }).subscribe({
    next(value) {
      values.push(value)
      subscription.unsubscribe()
    },
  })

  await tick()
  await tick()

  expect(values).toEqual([{ data: 'one' }])
  expect(cancelled).toBe(true)
})

test('emits an XFetchError for a non-ok streaming response', async () => {
  const { xfetch: request } = createXFetch(
    async () =>
      new Response(JSON.stringify({ message: 'nope' }), { status: 401 }),
  )

  const error = await new Promise<unknown>(resolve => {
    request('https://example.com', { middlewares: [withSSE] }).subscribe({
      error: resolve,
    })
  })

  expect(isXFetchError(error)).toBe(true)

  if (!isXFetchError(error)) {
    throw error
  }

  expect(error.response?.status).toBe(401)
})

test('implements the native observable API', async () => {
  const { xfetch: request } = createXFetch(
    async () => new Response('"value"', { status: 200 }),
  )

  const source = request<string>('https://example.com')

  // interop: the observable returns itself under both keys
  expect(source['@@observable']()).toBe(source)
  const symbolObservable: symbol | undefined = (
    Symbol as { observable?: symbol }
  ).observable
  if (symbolObservable) {
    const interop = source as unknown as Record<
      symbol,
      () => XFetchObservable<string>
    >
    expect(interop[symbolObservable]()).toBe(source)
  }

  // the three-argument form of `subscribe`
  const events: string[] = []
  await new Promise<void>(resolve => {
    const subscription = source.subscribe(
      value => {
        events.push(`next:${value}`)
      },
      error => {
        events.push(`error:${String(error)}`)
      },
      () => {
        events.push('complete')
        expect(subscription.closed).toBe(true)
        resolve()
      },
    )
  })

  expect(events).toEqual(['next:value', 'complete'])
})

test('aliases point at the same functions', () => {
  expect(observableXFetch).toBe(xfetch)
  expect(createObservableXFetch).toBe(createXFetch)
})

test('interoperates with rxjs', async () => {
  const { xfetch: request } = createXFetch(
    async () => new Response('{"ok":true}', { status: 200 }),
  )

  expect(
    await lastValueFrom(from(request<{ ok: boolean }>('https://example.com'))),
  ).toEqual({ ok: true })

  const withEvents: XFetchMiddleware = async (ctx, next) => {
    const response = await next()
    ctx.emit?.('alpha')
    ctx.emit?.('beta')
    return response
  }

  expect(
    await lastValueFrom(
      from(
        request('https://example.com', {
          middlewares: [withEvents],
        }),
      ).pipe(toArray()),
    ),
  ).toEqual(['alpha', 'beta'])
})

test('rxjs unsubscribe aborts the request', async () => {
  let signal: AbortSignal | undefined

  const { xfetch: request } = createXFetch(
    (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        signal = init?.signal ?? undefined
        signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        })
      }),
  )

  const subscription = from(request('https://example.com')).subscribe()

  await tick()
  expect(signal?.aborted).toBe(false)

  subscription.unsubscribe()
  expect(signal?.aborted).toBe(true)
})

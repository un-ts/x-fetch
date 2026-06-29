import type {
  XFetchBaseOptions,
  XFetchMiddleware,
  XFetchMiddlewareContext,
  XFetchOptions,
} from './types.js'
import {
  CONTENT_TYPE,
  extractDataFromResponse,
  isPlainObject,
  isXFetchError,
  normalizeUrl,
  XFetchError,
} from './utils.js'

export type * from './types.js'
export * from './utils.js'

/**
 * Creates an isolated x-fetch instance with its own middleware chain.
 * @param fetch — custom fetch implementation (defaults to `globalThis.fetch`)
 */
export const createXFetch = (fetch = globalThis.fetch) => {
  const middlewares_ = new Set<XFetchMiddleware>()

  const middlewares = {
    /** Register middleware(s) to run before every request. Returns `this` for chaining. */
    use(...middlewares: XFetchMiddleware[]) {
      for (const middleware of middlewares) {
        middlewares_.add(middleware)
      }
      return this
    },
    /** Remove a previously registered middleware. Returns `true` if it was removed. */
    eject(middleware: XFetchMiddleware) {
      return middlewares_.delete(middleware)
    },
  }

  /** Fetch a URL and parse as `null` — returns the raw `Response`. */
  function xfetch(
    url: string,
    options: XFetchBaseOptions & { type: null },
  ): Promise<Response>
  /** Fetch a URL and parse as `ArrayBuffer`. */
  function xfetch(
    url: string,
    options: XFetchBaseOptions & { type: 'arrayBuffer' },
  ): Promise<ArrayBuffer>
  /** Fetch a URL and parse as `Blob`. */
  function xfetch(
    url: string,
    options: XFetchBaseOptions & { type: 'blob' },
  ): Promise<Blob>
  /** Fetch a URL and parse as `text`. */
  function xfetch(
    url: string,
    options: XFetchBaseOptions & { type: 'text' },
  ): Promise<string>
  /** Fetch a URL and parse as JSON (default). */
  function xfetch<T>(
    url: string,
    options?: XFetchBaseOptions & { type?: 'json' },
  ): Promise<T>
  async function xfetch(
    url: string,
    {
      method = 'GET',
      body,
      headers,
      type = 'json',
      ...rest
    }: XFetchOptions = {},
  ) {
    let context: XFetchMiddlewareContext = {
      url,
      method,
      body,
      headers: new Headers(headers),
      type,
      ...rest,
    }

    const allMiddlewares = [...middlewares_, ...(context.middlewares || [])]

    const dispatch = async (
      i: number,
      ctx: XFetchMiddlewareContext,
    ): Promise<Response> => {
      try {
        if (i < allMiddlewares.length) {
          return await allMiddlewares[i](ctx, c => dispatch(i + 1, c || ctx))
        }

        context = ctx
        const json = isPlainObject(ctx.body) || Array.isArray(ctx.body)
        if (json && !ctx.headers.has(CONTENT_TYPE)) {
          ctx.headers.append(CONTENT_TYPE, 'application/json')
        }
        const response = await fetch(normalizeUrl(ctx.url, ctx.query), {
          ...ctx,
          body: json ? JSON.stringify(ctx.body) : (ctx.body as BodyInit),
        })
        if (response.ok) {
          return response
        }
        throw new XFetchError(ctx, {
          response,
          data: await extractDataFromResponse(response, ctx.type, true),
        })
      } catch (error) {
        if (isXFetchError(error)) {
          throw error
        }
        throw new XFetchError(ctx, { cause: error })
      }
    }

    const response = await dispatch(0, context)

    if (context.type == null) {
      return response
    }

    try {
      return await extractDataFromResponse(response, context.type)
    } catch (error) {
      throw new XFetchError(context, {
        cause: error,
        response,
        data: await extractDataFromResponse(response, context.type, true),
      })
    }
  }

  return { middlewares, xfetch }
}

/** Default instance — shared middleware chain, uses `globalThis.fetch`. */
export const { middlewares, xfetch } = createXFetch()

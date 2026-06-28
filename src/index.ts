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

export const createXFetch = (fetch = globalThis.fetch) => {
  const middlewares_ = new Set<XFetchMiddleware>()

  const middlewares = {
    use(...middlewares: XFetchMiddleware[]) {
      for (const middleware of middlewares) {
        middlewares_.add(middleware)
      }
      return this
    },
    eject(middleware: XFetchMiddleware) {
      return middlewares_.delete(middleware)
    },
  }

  function xfetch(
    url: string,
    options: XFetchBaseOptions & { type: null },
  ): Promise<Response>
  function xfetch(
    url: string,
    options: XFetchBaseOptions & { type: 'arrayBuffer' },
  ): Promise<ArrayBuffer>
  function xfetch(
    url: string,
    options: XFetchBaseOptions & { type: 'blob' },
  ): Promise<Blob>
  function xfetch(
    url: string,
    options: XFetchBaseOptions & { type: 'text' },
  ): Promise<string>
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
      json = body != null && (isPlainObject(body) || Array.isArray(body)),
      type = 'json',
      ...rest
    }: XFetchOptions = {},
  ) {
    headers = new Headers(headers)

    if (json && !headers.has(CONTENT_TYPE)) {
      headers.append(CONTENT_TYPE, 'application/json')
    }

    let context: XFetchMiddlewareContext = {
      url,
      method,
      body,
      headers,
      json,
      type,
      ...rest,
    }

    const allMiddlewares = [...middlewares_, ...(context.middlewares ?? [])]

    const dispatch = async (
      i: number,
      ctx: XFetchMiddlewareContext,
    ): Promise<Response> => {
      try {
        if (i < allMiddlewares.length) {
          return await allMiddlewares[i](ctx, c => dispatch(i + 1, c ?? ctx))
        }

        const { body, url, query, ...rest } = (context = ctx)
        const response = await fetch(normalizeUrl(url, query), {
          ...rest,
          body: ctx.json ? JSON.stringify(body) : (body as BodyInit),
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

export const { middlewares, xfetch } = createXFetch()

import {
  ApiMethod,
  type FetchApiOptions,
  type InterceptorRequest,
  type ApiInterceptor,
  type FetchApiBaseOptions,
  ResponseError,
} from './types.js'
import {
  CONTENT_TYPE,
  extractDataFromResponse,
  isPlainObject,
  normalizeUrl,
} from './utils.js'

export * from './types.js'
export * from './utils.js'

export class ApiInterceptors {
  // @internal
  declare private readonly _interceptors: ApiInterceptor[]

  constructor() {
    this._interceptors = []
  }

  get length() {
    return this._interceptors.length
  }

  at(index: number) {
    return this._interceptors.at(index)
  }

  use(...interceptors: ApiInterceptor[]) {
    this._interceptors.push(...interceptors)
    return this
  }

  eject(interceptor: ApiInterceptor) {
    const index = this._interceptors.indexOf(interceptor)
    if (index !== -1) {
      this._interceptors.splice(index, 1)
      return true
    }
    return false
  }
}

export const createXFetch = (fetch = globalThis.fetch) => {
  const interceptors = new ApiInterceptors()

  function xfetch(
    url: string,
    options: FetchApiBaseOptions & { type: null },
  ): Promise<Response>
  // @ts-expect-error -- no idea, it sucks
  function xfetch(
    url: string,
    options: FetchApiBaseOptions & { type: 'arraybuffer' },
  ): Promise<ArrayBuffer>
  function xfetch(
    url: string,
    options: FetchApiBaseOptions & { type: 'blob' },
  ): Promise<Blob>
  function xfetch(
    url: string,
    options: FetchApiBaseOptions & { type: 'text' },
  ): Promise<string>
  function xfetch<T>(
    url: string,
    options?: FetchApiBaseOptions & { type?: 'json' },
  ): Promise<T>
  async function xfetch(
    url: string,
    {
      method = ApiMethod.GET,
      body,
      headers,
      json = body != null && (isPlainObject(body) || Array.isArray(body)),
      type = 'json',
      ...rest
    }: FetchApiOptions = {},
  ) {
    headers = new Headers(headers)

    if (json && !headers.has(CONTENT_TYPE)) {
      headers.append(CONTENT_TYPE, 'application/json')
    }

    let index = 0

    const next = async (request: InterceptorRequest) => {
      if (index < interceptors.length) {
        return interceptors.at(index++)!(request, next)
      }
      const { body, url, query, ...rest } = request
      const response = await fetch(normalizeUrl(url, query), {
        ...rest,
        body: json ? JSON.stringify(body) : (body as BodyInit),
      })
      if (response.ok) {
        return response
      }
      throw new ResponseError(
        request,
        response,
        await extractDataFromResponse(response, type, true),
      )
    }

    const response = await next({
      url,
      method,
      body,
      headers,
      ...rest,
    })

    return type == null ? response : extractDataFromResponse(response, type)
  }

  return {
    interceptors,
    xfetch,
    /**
     * @deprecated Use {@link xfetch} instead.
     */
    fetchApi: xfetch,
  }
}

/**
 * @deprecated Use {@link createXFetch} instead.
 */
export const createFetchApi = createXFetch

// eslint-disable-next-line sonarjs/deprecation
export const { interceptors, xfetch, fetchApi } = createXFetch()

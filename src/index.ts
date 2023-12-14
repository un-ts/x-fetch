import type { URLSearchParametersOptions, ValueOf } from './types.js'
import { CONTENT_TYPE, isPlainObject, normalizeUrl } from './utils.js'

export type * from './types.js'
export * from './utils.js'

export const ApiMethod = {
  GET: 'GET',
  POST: 'POST',
  PATCH: 'PATCH',
  PUT: 'PUT',
  DELETE: 'DELETE',
} as const

export type ApiMethod = ValueOf<typeof ApiMethod>

export interface FetchApiBaseOptions
  extends Omit<RequestInit, 'body' | 'method'> {
  method?: ApiMethod
  body?: BodyInit | object
  query?: URLSearchParametersOptions
  json?: boolean
}

export interface FetchApiOptions extends FetchApiBaseOptions {
  type?: 'arrayBuffer' | 'blob' | 'json' | 'text' | null
}

export interface InterceptorRequest extends FetchApiOptions {
  url: string
}

export type ApiInterceptor = (
  request: InterceptorRequest,
  next: (request: InterceptorRequest) => PromiseLike<Response>,
) => PromiseLike<Response> | Response

export interface ResponseError<T = never> extends Error {
  data?: T | null
  response?: Response | null
}

export class ApiInterceptors {
  readonly #interceptors: ApiInterceptor[] = []

  get length() {
    return this.#interceptors.length
  }

  at(index: number) {
    return this.#interceptors.at(index)
  }

  use(...interceptors: ApiInterceptor[]) {
    this.#interceptors.push(...interceptors)
    return this
  }

  eject(interceptor: ApiInterceptor) {
    const index = this.#interceptors.indexOf(interceptor)
    if (index > -1) {
      this.#interceptors.splice(index, 1)
      return true
    }
    return false
  }
}

export const createFetchApi = () => {
  const interceptors = new ApiInterceptors()

  function fetchApi(
    url: string,
    options: FetchApiBaseOptions & { type: null },
  ): Promise<Response>
  // @ts-expect-error -- no idea, it sucks
  function fetchApi(
    url: string,
    options: FetchApiBaseOptions & { type: 'arraybuffer' },
  ): Promise<ArrayBuffer>
  function fetchApi(
    url: string,
    options: FetchApiBaseOptions & { type: 'blob' },
  ): Promise<Blob>
  function fetchApi(
    url: string,
    options: FetchApiBaseOptions & { type: 'text' },
  ): Promise<string>
  function fetchApi<T>(
    url: string,
    options?: FetchApiBaseOptions & { type?: 'json' },
  ): Promise<T>
  // eslint-disable-next-line sonarjs/cognitive-complexity
  async function fetchApi(
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
      let data: unknown = null
      if (type != null) {
        try {
          data = await response.clone()[type]()
        } catch {
          data = await response.clone().text()
        }
      }
      throw Object.assign(new Error(response.statusText), {
        data,
        response,
      })
    }

    const response = await next({
      url,
      method,
      body,
      headers,
      ...rest,
    })
    return type == null ? response : response.clone()[type]()
  }

  return { interceptors, fetchApi }
}

export const { interceptors, fetchApi } = createFetchApi()

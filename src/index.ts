import {
  ApiMethod,
  FetchApiOptions,
  InterceptorRequest,
  type ApiInterceptor,
  type FetchApiBaseOptions,
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

export const createFetchApi = (fetch = globalThis.fetch) => {
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
      throw Object.assign(new Error(response.statusText), {
        data: extractDataFromResponse(response, type),
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

    return type == null ? response : extractDataFromResponse(response, type)
  }

  return { interceptors, fetchApi }
}

export const { interceptors, fetchApi } = createFetchApi()

import type {
  XFetchMiddlewareContext,
  ResponseType,
  URLSearchParamsOptions,
} from './types.js'

export const CONTENT_TYPE = 'Content-Type'

// eslint-disable-next-line @typescript-eslint/unbound-method
const { toString } = Object.prototype // type-coverage:ignore-line -- https://github.com/plantain-00/type-coverage/issues/133

export const isPlainObject = <T extends object>(value: unknown): value is T =>
  toString.call(value) === '[object Object]'

// eslint-disable-next-line sonarjs/cognitive-complexity
export const normalizeUrl = (url: string, query?: URLSearchParamsOptions) => {
  let searchParams: URLSearchParams

  if (isPlainObject(query)) {
    searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(query) as Array<
      [string, unknown]
    >) {
      if (Array.isArray(value)) {
        for (const item of value as unknown[]) {
          if (item != null && item !== '') {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            searchParams.append(key, String(item))
          }
        }
      } else if (value != null && value !== '') {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        searchParams.set(key, String(value))
      }
    }
  } else {
    searchParams = new URLSearchParams(query)
  }

  const search = String(searchParams)
  // eslint-disable-next-line sonarjs/no-nested-conditional
  return search ? url + (url.includes('?') ? '&' : '?') + search : url
}

export async function extractDataFromResponse(
  res: Response,
  type: null,
  fallback?: boolean,
): Promise<Response>
export async function extractDataFromResponse(
  res: Response,
  type: 'arrayBuffer',
  fallback?: boolean,
): Promise<ArrayBuffer>
export async function extractDataFromResponse(
  res: Response,
  type: 'blob',
  fallback?: boolean,
): Promise<Blob>
export async function extractDataFromResponse<T>(
  res: Response,
  type: 'json',
  fallback?: boolean,
): Promise<T>
export async function extractDataFromResponse(
  res: Response,
  type: 'text',
  fallback?: boolean,
): Promise<string>
export async function extractDataFromResponse(
  res: Response,
  type: ResponseType,
  fallback?: boolean,
): Promise<unknown>
// eslint-disable-next-line sonarjs/cognitive-complexity
export async function extractDataFromResponse(
  res: Response,
  type: ResponseType,
  fallback?: boolean,
) {
  if (type == null) {
    return
  }
  let data: unknown
  if (type === 'json' || type === 'text') {
    try {
      // data could be empty text
      data = await res.clone().text()
    } catch {}
    if (type === 'json') {
      // eslint-disable-next-line sonarjs/no-nested-assignment
      if ((data = (data as string | undefined)?.trim())) {
        try {
          data = JSON.parse(data as string)
        } catch (err) {
          if (!fallback) {
            throw err
          }
        }
      } else {
        data = null
      }
    }
  } else {
    try {
      data = await res.clone()[type]()
    } catch (err) {
      if (!fallback) {
        throw err
      }
      data = await res.clone().text()
    }
  }
  return data
}

const brand = Symbol.for('x-fetch')

export class XFetchError<T = never> extends Error {
  response?: Response
  data?: T | null

  constructor(
    public context: XFetchMiddlewareContext,
    {
      response,
      data,
      cause,
    }: { response?: Response; data?: T | null; cause?: unknown },
  ) {
    super(
      (cause as Error | undefined)?.message ||
        (response && (response.statusText || response.status + '')),
      { cause },
    )
    this.response = response
    this.data = data
  }
}

Object.defineProperty(XFetchError.prototype, brand, { value: true })

export const isXFetchError = <T>(error: unknown): error is XFetchError<T> =>
  error != null && typeof error === 'object' && brand in error

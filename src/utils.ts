import type {
  Nullable,
  ResponseType,
  URLSearchParamsOptions,
  XFetchMiddlewareContext,
} from './types.js'

export const CONTENT_TYPE = 'Content-Type'

// eslint-disable-next-line @typescript-eslint/unbound-method
const { toString } = Object.prototype // type-coverage:ignore-line -- https://github.com/plantain-00/type-coverage/issues/133

/** Checks whether a value is a plain object (not `null`, array, or primitive). */
export const isPlainObject = <T extends object>(value: unknown): value is T =>
  toString.call(value) === '[object Object]'

/** Normalizes a URL by appending query parameters. `null`/`undefined` values are omitted. */
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
          if (item != null) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            searchParams.append(key, String(item))
          }
        }
      } else if (value != null) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        searchParams.set(key, String(value))
      }
    }
  } else {
    searchParams = new URLSearchParams(query)
  }

  // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
  const search = searchParams + ''
  // eslint-disable-next-line sonarjs/no-nested-conditional
  return search ? url + (url.includes('?') ? '&' : '?') + search : url
}

/** Parses a `Response` body based on `type`. When `fallback` is true, returns raw text on parse failure instead of throwing. */
export async function extractDataFromResponse(
  res: Response,
  type: null | undefined,
  fallback?: boolean,
): Promise<void>
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
    } catch (err) {
      if (!fallback) {
        throw err
      }
    }
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
        return
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

/** Error wrapping failed requests — carries the original `context`, `response`, and parsed `data`. */
export class XFetchError<T = never> extends Error {
  response?: Response
  data?: Nullable<T>

  constructor(
    public context: XFetchMiddlewareContext,
    {
      response,
      data,
      cause,
    }: { response?: Response; data?: Nullable<T>; cause?: unknown },
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

/** Type guard — checks if an error is an `XFetchError`, works across realms (iframes, workers). */
export const isXFetchError = <T>(error: unknown): error is XFetchError<T> =>
  error != null && typeof error === 'object' && brand in error

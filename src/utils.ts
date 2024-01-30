import {
  Nullable,
  ResponseType,
  URLSearchParamsOptions,
  ValueOf,
} from './types.js'

export const CONTENT_TYPE = 'Content-Type'

// eslint-disable-next-line @typescript-eslint/unbound-method
const { toString } = Object.prototype // type-coverage:ignore-line -- https://github.com/plantain-00/type-coverage/issues/133

const objectTag = '[object Object]'

export const isPlainObject = <T extends object>(value: unknown): value is T =>
  toString.call(value) === objectTag

export const cleanNilValues = <T = unknown>(input: T, empty?: boolean): T => {
  if (!isPlainObject(input)) {
    return input
  }

  for (const _key of Object.keys(input)) {
    const key = _key as keyof T
    const value = input[key] as Nullable<ValueOf<T>>
    if (empty ? !value : value == null) {
      delete input[key]
    } else {
      input[key] = cleanNilValues(value, empty) as (T & object)[keyof T]
    }
  }

  return input
}

export const normalizeUrl = (url: string, query?: URLSearchParamsOptions) => {
  const cleanedQuery = cleanNilValues(query, true)
  const searchParams = new URLSearchParams()
  if (isPlainObject(cleanedQuery)) {
    for (const [
      key,
      // type-coverage:ignore-next-line -- cannot control
      _value,
    ] of Object.entries(cleanedQuery)) {
      const value = _value as unknown
      if (Array.isArray(value)) {
        const items = value as unknown[]
        for (const item of items) {
          searchParams.append(key, String(item))
        }
      } else {
        searchParams.set(key, String(value))
      }
    }
  }
  const search = searchParams.toString()
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
  let data: unknown
  if (type != null) {
    if (type === 'json' || type === 'text') {
      try {
        // data could be empty text
        data = await res.clone().text()
      } catch {}
      if (type === 'json') {
        if ((data = (data as string).trim())) {
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
  }
  return data
}

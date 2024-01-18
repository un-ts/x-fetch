import {
  Nilable,
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
    const value = input[key] as Nilable<ValueOf<T>>
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
): Promise<Response>
export async function extractDataFromResponse(
  res: Response,
  type: 'arrayBuffer',
): Promise<ArrayBuffer>
export async function extractDataFromResponse(
  res: Response,
  type: 'blob',
): Promise<Blob>
export async function extractDataFromResponse<T>(
  res: Response,
  type: 'json',
): Promise<T>
export async function extractDataFromResponse(
  res: Response,
  type: 'text',
): Promise<string>
export async function extractDataFromResponse(
  res: Response,
  type: ResponseType,
): Promise<unknown>
// eslint-disable-next-line sonarjs/cognitive-complexity
export async function extractDataFromResponse(
  res: Response,
  type: ResponseType,
) {
  let data: unknown
  if (type != null) {
    if (type === 'json' || type === 'text') {
      try {
        // data could be empty text
        data = await res.clone().text()
      } catch {}
      if (type === 'json' && (data = (data as string).trim())) {
        try {
          data = JSON.parse(data as string)
        } catch {}
      }
    } else {
      try {
        data = await res.clone()[type]()
      } catch {
        data = await res.clone().text()
      }
    }
  }
  return data
}

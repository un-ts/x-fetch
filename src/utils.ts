import {
  Nullable,
  URLSearchParametersInit,
  URLSearchParametersOptions,
  ValueOf,
} from './types.js'

export const CONTENT_TYPE = 'Content-Type'

// eslint-disable-next-line @typescript-eslint/unbound-method
const { toString } = Object.prototype // type-coverage:ignore-line - TODO: report bug

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

export const normalizeUrl = (
  url: string,
  query?: URLSearchParametersOptions,
) => {
  const search = new URLSearchParams(
    cleanNilValues(query, true) as URLSearchParametersInit,
  ).toString()
  return search ? url + (url.includes('?') ? '&' : '?') + search : url
}

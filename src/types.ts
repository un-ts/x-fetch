export type Nullable<T> = T | null | undefined

export type Readonlyable<T> = Readonly<T> | T

export type AnyArray<T = unknown> = Readonlyable<T[]>

export type Arrayable<T, R extends boolean = false> = [R] extends [never]
  ? T | T[]
  : R extends true
    ? Readonly<T> | readonly T[]
    : R extends false
      ? AnyArray<T> | Readonlyable<T>
      : never

export type ValueOf<T> = T[keyof T]

export type URLSearchParamsInit = ConstructorParameters<
  typeof URLSearchParams
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
>[0]

export type URLSearchParamsOptions =
  | Record<string, Nullable<Arrayable<number | string>>>
  | URLSearchParamsInit
  | object

// https://www.rfc-editor.org/rfc/rfc9110#section-9.1-4
export const ApiMethod = {
  CONNECT: 'CONNECT',
  DELETE: 'DELETE',
  GET: 'GET',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
  PATCH: 'PATCH',
  POST: 'POST',
  PUT: 'PUT',
  TRACE: 'TRACE',
} as const

export type ApiMethod = ValueOf<typeof ApiMethod>

export interface FetchApiBaseOptions
  extends Omit<RequestInit, 'body' | 'method'> {
  method?: ApiMethod
  body?: BodyInit | object
  query?: URLSearchParamsOptions
  json?: boolean
}

export type ResponseType = 'arrayBuffer' | 'blob' | 'json' | 'text' | null

export interface FetchApiOptions extends FetchApiBaseOptions {
  type?: ResponseType
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
  request: Request
  response?: Response | null
}

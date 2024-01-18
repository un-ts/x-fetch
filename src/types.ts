export type Nil = null | undefined | void

export type Nilable<T> = Nil | T

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
  | Record<string, Nilable<Arrayable<number | string>>>
  | URLSearchParamsInit
  | object

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
  response?: Response | null
}

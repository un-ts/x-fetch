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

export type URLSearchParamsInit = NonNullable<
  ConstructorParameters<typeof URLSearchParams>[0]
>

export type URLSearchParamsOptions =
  | Record<string, Nullable<Arrayable<number | string>>>
  | URLSearchParamsInit
  | object

// istanbul ignore next
// https://www.rfc-editor.org/rfc/rfc9110#section-9.1-4
export const HttpMethod = {
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

export type HttpMethod = ValueOf<typeof HttpMethod>

export interface XFetchBaseOptions extends Omit<
  RequestInit,
  'body' | 'method'
> {
  method?: HttpMethod
  body?: BodyInit | object
  query?: URLSearchParamsOptions
  json?: boolean
  middlewares?: XFetchMiddleware[]
}

export type ResponseType =
  | 'arrayBuffer'
  | 'blob'
  | 'json'
  | 'text'
  | null
  | undefined

export interface XFetchOptions extends XFetchBaseOptions {
  // eslint-disable-next-line sonarjs/no-redundant-optional
  type?: ResponseType
}

export interface XFetchMiddlewareContext extends XFetchOptions {
  url: string
  method: HttpMethod
  headers: Headers
}

export type XFetchMiddlewareNext = (
  context?: XFetchMiddlewareContext,
) => PromiseLike<Response>

export type XFetchMiddleware = (
  context: XFetchMiddlewareContext,
  next: XFetchMiddlewareNext,
) => PromiseLike<Response> | Response

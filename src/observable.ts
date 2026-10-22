import type {
  XFetchBaseOptions,
  XFetchFunction,
  XFetchMiddleware,
  XFetchOptions,
} from './types.js'

import { createXFetch as createBaseXFetch } from './index.js'

export * from './types.js'
export { isXFetchError, XFetchError } from './utils.js'

declare global {
  interface SymbolConstructor {
    /** TC39 `Symbol.observable` — the key `from()` of RxJS looks for. */
    readonly observable: symbol
  }
}

declare module './types.js' {
  interface XFetchMiddlewareContext {
    /**
     * Only set for observable requests — pushes a value to the subscriber.
     *
     * It is assigned before the per-request middlewares run, so a middleware can
     * emit several values instead of the single one the request resolves to:
     *
     * ```ts
     * const withStream: XFetchMiddleware = async (ctx, next) => {
     *   const response = await next()
     *   ctx.emit?.(await response.text()) // one value per chunk/frame
     *   return response
     * }
     * ```
     */
    emit?: (value: unknown) => void
  }
}

/** Observer callbacks accepted by `XFetchObservable#subscribe`. */
export interface XFetchObserver<T> {
  next?: (value: T) => void
  error?: (error: unknown) => void
  complete?: () => void
}

/** Handle returned by `XFetchObservable#subscribe`. */
export interface XFetchSubscription {
  /** `true` once unsubscribed, errored or completed. */
  readonly closed: boolean
  unsubscribe: () => void
}

/** A minimal, dependency-free `Observable` — `subscribe()` is lazy and cold. */
export interface XFetchObservable<T> {
  subscribe: (
    observer: XFetchObserver<T> | ((value: T) => void),
    error?: (error: unknown) => void,
    complete?: () => void,
  ) => XFetchSubscription
  /** TC39 interop — returns the observable itself. */
  [Symbol.observable]: () => XFetchObservable<T>
  /** RxJS reads `Symbol.observable` when polyfilled, and this key otherwise. */
  '@@observable': () => XFetchObservable<T>
}

/** The observable-ized `xfetch` — every call returns an `XFetchObservable`. */
export interface XFetchObservableFunction {
  (
    url: string,
    options: XFetchBaseOptions & { type: null },
  ): XFetchObservable<Response>
  (
    url: string,
    options: XFetchBaseOptions & { type: 'arrayBuffer' },
  ): XFetchObservable<ArrayBuffer>
  (
    url: string,
    options: XFetchBaseOptions & { type: 'blob' },
  ): XFetchObservable<Blob>
  (
    url: string,
    options: XFetchBaseOptions & { type: 'text' },
  ): XFetchObservable<string>
  <T>(
    url: string,
    options?: XFetchBaseOptions & { type?: 'json' },
  ): XFetchObservable<T>
}

/**
 * Creates a cold observable: `init` runs on every `subscribe()` call, its
 * optional return value is used as the teardown function of that subscription.
 */
const createObservable = <T>(
  init: (observer: Required<XFetchObserver<T>>) => (() => void) | undefined,
): XFetchObservable<T> => {
  const observable = {
    subscribe(
      observer: XFetchObserver<T> | ((value: T) => void),
      error?: (error: unknown) => void,
      complete?: () => void,
    ) {
      const target: XFetchObserver<T> =
        typeof observer === 'function'
          ? { next: observer, error, complete }
          : observer

      let closed = false

      const notify: Required<XFetchObserver<T>> = {
        next(value) {
          if (!closed) {
            target.next?.(value)
          }
        },
        error(reason) {
          if (!closed) {
            closed = true
            target.error?.(reason)
          }
        },
        complete() {
          if (!closed) {
            closed = true
            target.complete?.()
          }
        },
      }

      const stop = init(notify)

      return {
        get closed() {
          return closed
        },
        unsubscribe() {
          closed = true
          stop?.()
        },
      }
    },
  } as unknown as XFetchObservable<T>

  const self = () => observable

  Object.assign(observable, { '@@observable': self })

  // `Symbol.observable` is optional at runtime, see the `symbol-observable` shim
  const symbolObservable: symbol | undefined = (
    Symbol as { observable?: symbol }
  ).observable
  if (symbolObservable) {
    Object.assign(observable, { [symbolObservable]: self })
  }

  return observable
}

/** Options the observable entry seeds before any middleware runs. */
interface XFetchObservableRequestOptions extends XFetchOptions {
  emit?: (value: unknown) => void
}

const createRequest = <T>(
  xfetch: XFetchFunction,
  url: string,
  options?: XFetchOptions,
): XFetchObservable<T> =>
  createObservable<T>(observer => {
    const controller = new AbortController()
    let emitted = false

    const abort = () => {
      controller.abort()
    }

    // Cascade the caller signal for the whole subscription, not only for the
    // dispatch phase: a streaming body keeps reading after the headers arrived.
    const callerSignal = options?.signal
    if (callerSignal?.aborted) {
      // the caller gave up before the request was dispatched
      controller.abort()
    } else {
      callerSignal?.addEventListener('abort', abort, { once: true })
    }

    const detach = () => {
      callerSignal?.removeEventListener('abort', abort)
    }

    // Kept innermost so a middleware overriding `ctx.signal` (timeout, retry)
    // cannot take the abort of `unsubscribe()` away from the request.
    const withSignal: XFetchMiddleware = (ctx, next) => {
      ctx.signal = controller.signal
      return next()
    }

    // `xfetch` is overloaded on `type`, the overload is picked by the caller.
    const request = xfetch as unknown as (
      url: string,
      options?: XFetchObservableRequestOptions,
    ) => Promise<T>

    // `emit` and `signal` ride on the initial options, so the first middleware
    // in the chain (globals included) already has both.
    request(url, {
      ...options,
      emit: value => {
        emitted = true
        observer.next(value as T)
      },
      signal: controller.signal,
      middlewares: [...(options?.middlewares ?? []), withSignal],
    }).then(
      data => {
        detach()
        if (!emitted) {
          observer.next(data)
        }
        observer.complete()
      },
      (error: unknown) => {
        detach()
        observer.error(error)
      },
    )

    return () => {
      detach()
      controller.abort()
    }
  })

/**
 * Creates an isolated x-fetch instance whose `xfetch` returns an
 * `XFetchObservable` instead of a `Promise` — same middleware chain, same
 * options, same errors.
 *
 * @param fetch — custom fetch implementation (defaults to `globalThis.fetch`)
 */
export const createXFetch = (fetch = globalThis.fetch) => {
  const { middlewares, xfetch } = createBaseXFetch(fetch)
  const observableXFetch = (<T>(url: string, options?: XFetchOptions) =>
    createRequest<T>(
      xfetch,
      url,
      options,
    )) as unknown as XFetchObservableFunction
  return { middlewares, xfetch: observableXFetch }
}

/** Default instance — shared middleware chain, uses `globalThis.fetch`. */
export const { middlewares, xfetch } = createXFetch()

/** Aliases, for when both entries are imported at once. */
export { createXFetch as createObservableXFetch, xfetch as observableXFetch }

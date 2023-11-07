export type Nullable<T> = T | null | undefined

export type ValueOf<T> = T[keyof T]

export type URLSearchParametersInit = ConstructorParameters<
  typeof URLSearchParams
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
>[0]

export type URLSearchParametersOptions =
  | Record<string, Nullable<number | string>>
  | URLSearchParametersInit
  | object

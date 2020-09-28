import { NormalizedShape } from "../NormalizedType"

export interface BaseQueryKey {
  matches(qk: BaseQueryKey): boolean
}

export interface QueryUpdateFn {
  (
    currentValue: any,
    info: {
      mutationResult: any
      mutationArgs: any
      optimistic: boolean
      queryArgs: any
    }
  ): any
}

export abstract class BaseQuery {
  constructor(
    readonly key: BaseQueryKey,
    readonly options: {
      shape?: NormalizedShape
      mutations?: Record<string, QueryUpdateFn>
      arguments?: any
    } = {}
  ) {}
}

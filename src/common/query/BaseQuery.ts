import { NormalizedShape, TransformShape } from "../NormalizedType"

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
      transform?: TransformShape
      mutations?: Record<string, QueryUpdateFn>
      arguments?: any
    } = {}
  ) {}

  isSibling(query: BaseQuery): boolean {
    return false
  }
}

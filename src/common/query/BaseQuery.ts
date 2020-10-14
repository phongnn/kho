import { NormalizedShape, TransformShape } from "../NormalizedType"
import { Selector } from "../Selector"

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

export interface RelatedQueryUpdateFn {
  (
    currentValue: any,
    info: {
      relatedQueryResult: any
      relatedQueryArgs: any
      queryArgs: any
    }
  ): any
}

export abstract class BaseQuery {
  constructor(
    readonly key: BaseQueryKey,
    readonly name: string,
    readonly options: {
      arguments?: any
      shape?: NormalizedShape
      transform?: TransformShape
      selector?: Selector
      mutations?: Record<string, QueryUpdateFn>
      relatedQueries?: Record<string, RelatedQueryUpdateFn>
    } = {}
  ) {}

  isSibling(query: BaseQuery): boolean {
    return false
  }
}

import { NormalizedShape } from "../normalization/NormalizedType"
import { Selector } from "../normalization/Selector"

export interface BaseQueryKey {
  matches(key: BaseQueryKey): boolean
  matchesPlain(plainKey: any): boolean
  plain(): any
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
      selector?: Selector
      queryUpdates?: Record<string, RelatedQueryUpdateFn>
    } = {}
  ) {}
}

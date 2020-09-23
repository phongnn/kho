import { NormalizedShape } from "./NormalizedType"

export interface BaseQueryKey {
  matches(qk: BaseQueryKey): boolean
}

export interface QueryUpdateInfoArgument {
  mutationResult: any
  mutationArgs: any
  optimistic: boolean
  context: any
}

export interface QueryUpdateFn {
  (currentValue: any, info: QueryUpdateInfoArgument): any
}

export abstract class BaseQuery {
  constructor(
    readonly key: BaseQueryKey,
    readonly options: {
      shape?: NormalizedShape
      mutations?: Record<string, QueryUpdateFn>
    } = {}
  ) {}
}

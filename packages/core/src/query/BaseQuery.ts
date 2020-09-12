import { NormalizedShape } from "../normalization/NormalizedType"

export interface BaseQueryKey {
  matches(qk: BaseQueryKey): boolean
}

export abstract class BaseQuery {
  constructor(
    readonly key: BaseQueryKey,
    readonly options: {
      shape?: NormalizedShape
    } = {}
  ) {}
}

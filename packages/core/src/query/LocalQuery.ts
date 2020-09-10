import { BaseQueryKey, BaseQuery } from "./BaseQuery"
import { NormalizedShape } from "../normalization/NormalizedType"

export interface LocalQueryOptions {
  shape?: NormalizedShape
}

class LocalQueryKey implements BaseQueryKey {
  constructor(private name: string) {}

  matches(qk: BaseQueryKey): boolean {
    return qk instanceof LocalQueryKey && qk.name === this.name
  }
}

export class LocalQuery<TResult> extends BaseQuery {
  constructor(readonly name: string, readonly options: LocalQueryOptions = {}) {
    super(new LocalQueryKey(name), options)
  }

  clone() {
    return new LocalQuery<TResult>(this.name, this.options)
  }
}

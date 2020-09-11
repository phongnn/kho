import { BaseQueryKey, BaseQuery } from "./BaseQuery"
import { NormalizedShape } from "../normalization/NormalizedType"

export interface LocalQueryOptions<TData> {
  shape?: NormalizedShape
  initialValue?: TData
}

class LocalQueryKey implements BaseQueryKey {
  constructor(private name: string) {}

  matches(qk: BaseQueryKey): boolean {
    return qk instanceof LocalQueryKey && qk.name === this.name
  }
}

export class LocalQuery<TData> extends BaseQuery {
  constructor(
    readonly name: string,
    readonly options: LocalQueryOptions<TData> = {}
  ) {
    super(new LocalQueryKey(name), options)
  }

  clone() {
    return new LocalQuery<TData>(this.name, this.options)
  }
}

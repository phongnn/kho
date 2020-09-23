import { BaseQueryKey, BaseQuery, QueryUpdateFn } from "./BaseQuery"
import { NormalizedShape } from "../normalization/NormalizedType"

class LocalQueryKey implements BaseQueryKey {
  constructor(private name: string) {}

  matches(qk: BaseQueryKey): boolean {
    return qk instanceof LocalQueryKey && qk.name === this.name
  }
}

export class LocalQuery<TData> extends BaseQuery {
  constructor(
    readonly name: string,
    readonly options: {
      shape?: NormalizedShape
      initialValue?: TData
      mutations?: Record<string, QueryUpdateFn>
    } = {}
  ) {
    super(new LocalQueryKey(name), options)
  }

  clone() {
    return new LocalQuery<TData>(this.name, this.options)
  }
}

import { BaseQueryKey, BaseQuery, QueryUpdateFn } from "./BaseQuery"
import { NormalizedShape, TransformShape } from "../NormalizedType"
import { Selector } from "../Selector"

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
      transform?: TransformShape
      initialValue?: TData
      mutations?: Record<string, QueryUpdateFn>
      selector?: Selector
    } = {}
  ) {
    super(new LocalQueryKey(name), options)
  }

  clone() {
    return new LocalQuery<TData>(this.name, this.options)
  }
}

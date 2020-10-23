import {
  BaseQueryKey,
  BaseQuery,
  QueryUpdateFn,
  RelatedQueryUpdateFn,
} from "./BaseQuery"
import {
  NormalizedShape,
  TransformShape,
} from "../normalization/NormalizedType"
import { Selector } from "../normalization/Selector"

class LocalQueryKey implements BaseQueryKey {
  constructor(private name: string) {}

  matches(qk: BaseQueryKey): boolean {
    return qk instanceof LocalQueryKey && qk.name === this.name
  }

  matchesPlain(plainKey: any): boolean {
    const { type, name } = plainKey
    return type === "LocalQuery" && name === this.name
  }

  plain = () => ({ type: "LocalQuery", name: this.name })
}

export class LocalQuery<TData> extends BaseQuery {
  constructor(
    readonly name: string,
    readonly options: {
      shape?: NormalizedShape
      transform?: TransformShape
      initialValue?: TData
      mutations?: Record<string, QueryUpdateFn>
      queryUpdates?: Record<string, RelatedQueryUpdateFn>
      selector?: Selector
    } = {}
  ) {
    super(new LocalQueryKey(name), name, options)
  }

  clone() {
    return new LocalQuery<TData>(this.name, this.options)
  }
}

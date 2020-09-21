import { BaseQueryKey, BaseQuery, QueryUpdateFn } from "./BaseQuery"
import { NormalizedShape } from "../normalization/NormalizedType"

class LocalQueryKey implements BaseQueryKey {
  constructor(private name: string) {}

  matches(qk: BaseQueryKey): boolean {
    return qk instanceof LocalQueryKey && qk.name === this.name
  }
}

export class LocalQuery<TData> extends BaseQuery {
  readonly options: {
    // "shape" is always undefined, meaning that data is not normalized.
    // Not normalized -> selector not required -> value can be set by Mutation's update() function
    // (unlike a remote query which can't be set by update() unless it's already in cache).
    // The property still has to be declared here because it's expected by BaseQuery class.
    shape?: NormalizedShape
    initialValue?: TData
    mutations?: Record<string, QueryUpdateFn>
  }

  constructor(
    readonly name: string,
    options: {
      initialValue?: TData
      mutations?: Record<string, QueryUpdateFn>
    } = {}
  ) {
    super(new LocalQueryKey(name), options)
    this.options = options
  }

  clone() {
    return new LocalQuery<TData>(this.name, this.options)
  }
}

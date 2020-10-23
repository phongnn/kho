import { BaseQueryKey, BaseQuery } from "./BaseQuery"
import { Query } from "./Query"

class CompoundQueryKey implements BaseQueryKey {
  constructor(private name: string) {}

  matches(qk: BaseQueryKey): boolean {
    return qk instanceof CompoundQueryKey && qk.name === this.name
  }

  matchesPlain(plainKey: any): boolean {
    const { type, name } = plainKey
    return type === "CompoundQuery" && name === this.name
  }

  plain = () => ({ type: "CompoundQuery", name: this.name })
}

/**
 * This class is used for the handling of "fetchMore" functionality
 * where we merge data of subsequent queries into the data of the first one.
 */
export class CompoundQuery<TResult, TArguments, TContext>
  extends BaseQuery
  implements Iterable<Query<TResult, TArguments, TContext>> {
  private queries = new Set<Query<TResult, TArguments, TContext>>()

  constructor(readonly original: Query<TResult, TArguments, TContext>) {
    super(new CompoundQueryKey(original.name), original.name, {
      ...original.options,
      arguments: undefined,
    })
    this.queries.add(original)
  }

  addNextQuery(query: Query<TResult, TArguments, TContext>) {
    this.queries.add(query)
  }

  [Symbol.iterator]() {
    return this.queries.values()
  }

  get size() {
    return this.queries.size
  }
}

export default CompoundQuery

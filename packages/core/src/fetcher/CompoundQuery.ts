import { BaseQueryKey, BaseQuery } from "../query/BaseQuery"
import { Query } from "../query/Query"

class CompoundQueryKey implements BaseQueryKey {
  constructor(private name: string) {}

  matches(qk: BaseQueryKey): boolean {
    return qk instanceof CompoundQueryKey && qk.name === this.name
  }
}

/**
 * This class is used for the handling of "fetchMore" functionality
 * where we merge data of subsequent queries into the data of the first one.
 */
class CompoundQuery<TResult, TArguments, TContext>
  extends BaseQuery
  implements Iterable<Query<TResult, TArguments, TContext>> {
  private queries = new Set<Query<TResult, TArguments, TContext>>()

  constructor(readonly original: Query<TResult, TArguments, TContext>) {
    super(new CompoundQueryKey(original.name), original.options)
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

import { BaseQueryKey, BaseQuery } from "./BaseQuery"
import { Query } from "./Query"
import { NormalizedShape } from "../normalization/NormalizedType"

interface CompoundQueryOptions<TResult, TArguments, TContext> {
  shape?: NormalizedShape
  merge?: (
    existingData: TResult,
    newData: TResult,
    args: TArguments,
    ctx: TContext
  ) => TResult
}

class CompoundQueryKey implements BaseQueryKey {
  constructor(private name: string) {}

  matches(qk: BaseQueryKey): boolean {
    return qk instanceof CompoundQueryKey && qk.name === this.name
  }
}

export class CompoundQuery<TResult, TArguments, TContext>
  extends BaseQuery
  implements Iterable<Query<TResult, TArguments, TContext>> {
  readonly options: CompoundQueryOptions<TResult, TArguments, TContext>
  private queries = new Set<Query<TResult, TArguments, TContext>>()

  constructor(originalQuery: Query<TResult, TArguments, TContext>) {
    super(new CompoundQueryKey(originalQuery.name), {
      shape: originalQuery.options.shape,
    })
    this.options = {
      // shape: originalQuery.options.shape,
      merge: originalQuery.options.merge,
    }
  }

  addNextQuery(query: Query<TResult, TArguments, TContext>) {
    this.queries.add(query)
  }

  [Symbol.iterator]() {
    return this.queries.values()
  }
}

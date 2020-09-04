import { InternalStore, QueryRegistrationResult } from "../Store"
import { Query, BaseQuery, QueryKey } from "../Query"
import Fetcher from "./Fetcher"
import CacheController from "./CacheController"
import { NormalizedShape } from "../NormalizedType"

class StandardStore implements InternalStore {
  private fetcher = new Fetcher()
  private cache = new CacheController()

  registerQuery<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    callbacks: {
      onRequest?: () => void
      onData: (data: TResult) => void
      onError?: (err: Error) => void
    }
  ) {
    const { onRequest, onData, onError } = callbacks

    // makes sure query instance is unique, not shared among UI components
    const uniqueQuery = query.clone()
    const queryHandle = !query.options.merge
      ? uniqueQuery
      : new CompoundQuery(uniqueQuery)

    const alreadyCached = this.cache.subscribe(queryHandle, onData)
    if (!alreadyCached) {
      this.fetcher.addRequest(uniqueQuery, {
        onStart: onRequest,
        onComplete: (data) => this.cache.storeQueryData(queryHandle, data),
        onError,
      })
    }

    const result: QueryRegistrationResult<TResult, TArguments, TContext> = {
      unregister: () => this.cache.unsubscribe(queryHandle),
      fetchMore: (nextQuery, callbacks) => {
        if (!(queryHandle instanceof CompoundQuery)) {
          throw new Error(
            `[FNC] fetchMore: merge() function not defined for query ${query.name}`
          )
        }

        this.fetchMore(queryHandle, nextQuery, callbacks)
      },
    }

    return result
  }

  private fetchMore<TResult, TArguments, TContext>(
    query: CompoundQuery<TResult, TArguments, TContext>,
    nextQuery: Query<TResult, TArguments, TContext>,
    callbacks: {
      onRequest?: () => void
      onError?: (err: Error) => void
    } = {}
  ) {
    const { onRequest, onError } = callbacks
    const mergeFn = nextQuery.options.merge || query.options.merge
    this.fetcher.addRequest(nextQuery, {
      onStart: onRequest,
      onError,
      onComplete: (newData) => {
        const { arguments: args, context } = nextQuery.options
        const existingData = this.cache.retrieveQueryData(query)
        const mergedData = mergeFn!(existingData, newData, args!, context!)
        this.cache.storeQueryData(query, mergedData)
      },
    })
  }
}

export interface CompoundQueryOptions<TResult, TArguments, TContext> {
  shape?: NormalizedShape
  merge?: (
    existingData: TResult,
    newData: TResult,
    args: TArguments,
    ctx: TContext
  ) => TResult
}

class CompoundQueryKey implements QueryKey {
  constructor(private name: string) {}

  matches(qk: QueryKey): boolean {
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

  [Symbol.iterator]() {
    return this.queries.values()
  }
}

export default StandardStore

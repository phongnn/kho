import { InternalStore, QueryRegistrationResult } from "../Store"
import { Query } from "../../query/Query"
import CompoundQuery from "./CompoundQuery"
import Fetcher from "./Fetcher"
import CacheController from "./CacheController"

class StandardStore implements InternalStore {
  private fetcher = new Fetcher()
  private cache = new CacheController()

  registerQuery<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    callbacks: {
      onData: (data: TResult) => void
      onRequest?: () => void
      onError?: (err: Error) => void
      onComplete?: () => void
    }
  ) {
    const { onRequest, onData, onError, onComplete } = callbacks

    // makes sure query instance is unique, not shared among UI components
    const uniqueQuery = query.clone()
    const queryHandle = !query.options.merge
      ? uniqueQuery
      : new CompoundQuery(uniqueQuery)

    const alreadyCached = this.cache.subscribe(queryHandle, onData)
    if (!alreadyCached) {
      this.fetcher.addRequest(uniqueQuery, {
        onRequest,
        onError,
        onComplete,
        onData: (data) => this.cache.storeQueryData(queryHandle, data),
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

        queryHandle.addNextQuery(nextQuery)
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
      onComplete?: () => void
    } = {}
  ) {
    const { onRequest, onError, onComplete } = callbacks
    const mergeFn = nextQuery.options.merge || query.original.options.merge
    this.fetcher.addRequest(nextQuery, {
      onRequest,
      onError,
      onComplete,
      onData: (newData) => {
        const { arguments: args, context } = nextQuery.options
        const existingData = this.cache.retrieveActiveQueryData(query)
        const mergedData = mergeFn!(existingData, newData, args!, context!)
        this.cache.storeQueryData(query, mergedData)
      },
    })
  }
}

export default StandardStore

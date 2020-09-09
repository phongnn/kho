import { QueryRegistrationResult } from "../Store"
import { Query } from "../../query/Query"
import CompoundQuery from "../../fetcher/CompoundQuery"
import Fetcher from "../../fetcher/Fetcher"
import CacheController from "./CacheController"

class QueryHandler {
  private fetcher = new Fetcher()

  constructor(private cache: CacheController) {}

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
    const queryHandle = !uniqueQuery.options.merge
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

    const { pollInterval = 0 } = uniqueQuery.options
    let stopPollingFn =
      pollInterval > 0 ? this.startPolling(queryHandle, pollInterval) : () => {}

    const result: QueryRegistrationResult<TResult, TArguments, TContext> = {
      unregister: () => {
        stopPollingFn()
        this.cache.unsubscribe(queryHandle)
      },
      refetch: (callbacks) => this.refetch(queryHandle, callbacks),
      fetchMore: (nextQuery, callbacks) => {
        if (!(queryHandle instanceof CompoundQuery)) {
          throw new Error(
            `[FNC] fetchMore: merge() function not defined for query ${query.name}`
          )
        }

        const uniqueNextQuery = nextQuery.clone() // for safety reason
        queryHandle.addNextQuery(uniqueNextQuery)
        this.fetchMore(queryHandle, uniqueNextQuery, callbacks)
      },
      startPolling: (interval?: number) => {
        stopPollingFn() // clear the previous interval
        stopPollingFn = this.startPolling(queryHandle, interval || pollInterval)
      },
      stopPolling: () => stopPollingFn(),
    }

    return result
  }

  refetch<TResult, TArguments, TContext>(
    query:
      | Query<TResult, TArguments, TContext>
      | CompoundQuery<TResult, TArguments, TContext>,
    callbacks: {
      onRequest?: () => void
      onError?: (err: Error) => void
      onComplete?: () => void
    } = {}
  ) {
    const { onRequest, onError, onComplete } = callbacks
    this.fetcher.addRequest(query, {
      onRequest,
      onError,
      onComplete,
      onData: (newData) => this.cache.storeQueryData(query, newData),
    })
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
        this.cache.mergeQueryData(query, newData, (edata, ndata) =>
          mergeFn!(edata, ndata, args!, context!)
        )
      },
    })
  }

  private startPolling<TResult, TArguments, TContext>(
    queryHandle:
      | Query<TResult, TArguments, TContext>
      | CompoundQuery<TResult, TArguments, TContext>,
    pollInterval: number
  ) {
    const interval = setInterval(() => {
      this.fetcher.addRequest(queryHandle, {
        onData: (data) => this.cache.storeQueryData(queryHandle, data),
      })
    }, pollInterval)

    return () => clearInterval(interval)
  }
}

export default QueryHandler

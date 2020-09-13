import { QueryRegistrationResult } from "../Store"
import { Query } from "../../query/Query"
import CompoundQuery from "../../fetcher/CompoundQuery"
import Fetcher from "../../fetcher/Fetcher"
import CacheController from "./CacheController"
import { getActualQuery } from "../../helpers"

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
    const { fetchPolicy, pollInterval = 0, merge } = query.options
    const networkOnly = fetchPolicy === "network-only"
    const cacheAndNetwork = fetchPolicy === "cache-and-network"

    // makes sure query instance is unique, not shared among UI components
    const uniqueQuery = query.clone()
    const queryHandle = getActualQuery(uniqueQuery) // convert to compound query if necessary
    const onDataCallback = networkOnly
      ? onData
      : (data: TResult) => this.cache.storeQueryData(queryHandle, data)

    let alreadyCached = false
    if (!networkOnly) {
      alreadyCached = this.cache.subscribe(queryHandle, onData)
      if (alreadyCached && onComplete) {
        setTimeout(onComplete)
      }
    }

    if (!alreadyCached || cacheAndNetwork) {
      this.fetcher.addRequest(uniqueQuery, {
        onRequest,
        onError,
        onComplete,
        onData: onDataCallback,
      })
    }

    let stopPollingFn = () => {} // no-op
    if (pollInterval > 0) {
      // prettier-ignore
      stopPollingFn = this.startPolling(queryHandle, pollInterval, onDataCallback)
    }

    const result: QueryRegistrationResult<TResult, TArguments, TContext> = {
      unregister: () => {
        stopPollingFn()
        if (!networkOnly) {
          this.cache.unsubscribe(queryHandle)
        }
      },
      refetch: (callbacks = {}) =>
        this.refetch(queryHandle, {
          ...callbacks,
          onData: onDataCallback,
        }),
      fetchMore: (nextQuery, callbacks) => {
        if (networkOnly) {
          throw new Error(
            `[FNC] query ${query.name} is network-only and doesn't support fetchMore.`
          )
        } else if (!(queryHandle instanceof CompoundQuery)) {
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
        // prettier-ignore
        stopPollingFn = this.startPolling(queryHandle, interval || pollInterval, onDataCallback)
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
      onData?: (data: TResult) => void
    } = {}
  ) {
    const { onRequest, onError, onComplete, onData } = callbacks
    this.fetcher.addRequest(query, {
      onRequest,
      onError,
      onComplete,
      onData: onData || ((data) => this.cache.storeQueryData(query, data)),
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
          mergeFn!(edata, ndata, { arguments: args!, context: context! })
        )
      },
    })
  }

  private startPolling<TResult, TArguments, TContext>(
    queryHandle:
      | Query<TResult, TArguments, TContext>
      | CompoundQuery<TResult, TArguments, TContext>,
    pollInterval: number,
    onData: (data: TResult) => void
  ) {
    const interval = setInterval(
      () => this.fetcher.addRequest(queryHandle, { onData }),
      pollInterval
    )

    return () => clearInterval(interval)
  }
}

export default QueryHandler

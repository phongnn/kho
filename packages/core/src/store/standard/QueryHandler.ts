import { QueryRegistrationResult } from "../Store"
import { Query } from "../../query/Query"
import CompoundQuery from "../../fetcher/CompoundQuery"
import Fetcher from "../../fetcher/Fetcher"
import CacheController from "./CacheController"
import { getActualQuery } from "../../helpers"

class QueryHandler {
  private fetcher = new Fetcher()

  constructor(private cache: CacheController) {}

  /** one-off data fetching */
  fetchQuery<TResult, TArguments, TContext>(
    query:
      | Query<TResult, TArguments, TContext>
      | CompoundQuery<TResult, TArguments, TContext>,
    networkOnly: boolean
  ) {
    return new Promise<TResult>((resolve, reject) => {
      if (!networkOnly) {
        const cachedData = this.cache.retrieveQueryData(query)
        if (cachedData !== undefined) {
          return resolve(cachedData)
        }
      }

      this.fetcher.addRequest(query, {
        onData: (data) => {
          this.cache.storeQueryData(query, data)
          resolve(data)
        },
        onError: (e) => reject(e),
      })
    })
  }

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
    const { fetchPolicy, pollInterval = 0 } = query.options
    const networkOnly = fetchPolicy === "network-only"
    const cacheAndNetwork = fetchPolicy === "cache-and-network"

    let networkOnlyData: TResult // cache data for later "fetchMore"
    const networkOnlyDataCallback = (data: TResult) => {
      networkOnlyData = data
      onData(data)
    }

    // makes sure query instance is unique, not shared among UI components
    const uniqueQuery = query.clone()
    const queryHandle = getActualQuery(uniqueQuery) // convert to compound query if necessary
    const onDataCallback = networkOnly
      ? networkOnlyDataCallback
      : (data: TResult) => this.cache.storeQueryData(queryHandle, data)

    let alreadyCached = false
    if (!networkOnly) {
      alreadyCached = this.cache.subscribe(queryHandle, onData)
      if (alreadyCached && onComplete) {
        setTimeout(onComplete)
      }
    }

    if (!alreadyCached || cacheAndNetwork) {
      this.fetcher.addRequest(
        uniqueQuery,
        {
          onRequest,
          onError,
          onComplete,
          onData: onDataCallback,
        },
        { ignoreDedupOnData: !networkOnly }
      )
    }

    let stopPollingFn = () => {} // no-op
    if (pollInterval > 0) {
      stopPollingFn = this.startPolling(
        queryHandle,
        pollInterval,
        onDataCallback,
        { ignoreDedupOnData: !networkOnly }
      )
    }

    const result: QueryRegistrationResult<TResult, TArguments, TContext> = {
      unregister: () => {
        stopPollingFn()
        this.cache.unsubscribe(queryHandle) // if (!networkOnly)
      },
      refetch: (callbacks = {}) =>
        this.fetcher.addRequest(
          queryHandle,
          {
            ...callbacks,
            onData: onDataCallback,
          },
          { ignoreDedupOnData: !networkOnly }
        ),
      fetchMore: (nextQuery, callbacks) => {
        if (!(queryHandle instanceof CompoundQuery)) {
          // prettier-ignore
          throw new Error(`[Kho] merge() function not defined for query ${query.name}.`)
        }

        const uniqueNextQuery = nextQuery.clone() // for safety reason
        queryHandle.addNextQuery(uniqueNextQuery)

        const mergeFn =
          nextQuery.options.merge || queryHandle.original.options.merge
        this.fetcher.addRequest(nextQuery, {
          ...callbacks,
          onData: (newData) => {
            const { arguments: args, context } = nextQuery.options
            if (!networkOnly) {
              this.cache.mergeQueryData(queryHandle, newData, (edata, ndata) =>
                mergeFn!(edata, ndata, {
                  arguments: args!,
                  context: context!,
                })
              )
            } else {
              networkOnlyDataCallback(
                // prettier-ignore
                mergeFn!(networkOnlyData, newData, { arguments: args!, context: context! })
              )
            }
          },
        })
      },
      startPolling: (interval?: number) => {
        stopPollingFn() // clear the previous interval
        stopPollingFn = this.startPolling(
          queryHandle,
          interval || pollInterval,
          onDataCallback,
          { ignoreDedupOnData: !networkOnly }
        )
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
      onData: (data: TResult) => void
      onRequest?: () => void
      onError?: (err: Error) => void
      onComplete?: () => void
    }
  ) {
    this.fetcher.addRequest(query, callbacks, { ignoreDedupOnData: true })
  }

  private startPolling<TResult, TArguments, TContext>(
    queryHandle:
      | Query<TResult, TArguments, TContext>
      | CompoundQuery<TResult, TArguments, TContext>,
    pollInterval: number,
    onData: (data: TResult) => void,
    options: { ignoreDedupOnData: boolean }
  ) {
    const interval = setInterval(
      () => this.fetcher.addRequest(queryHandle, { onData }, options),
      pollInterval
    )

    return () => clearInterval(interval)
  }
}

export default QueryHandler

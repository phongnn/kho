import { InternalStore } from "../Store"
import { Query } from "../Query"
import Fetcher from "./Fetcher"
import InMemoryCache from "./InMemoryCache"

class StandardStore implements InternalStore {
  private fetcher = new Fetcher()
  private cache = new InMemoryCache()

  registerQuery<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>,
    callbacks: {
      onRequest: () => void
      onData: (data: TResult) => void
      onError: (err: Error) => void
    }
  ) {
    const { fetchPolicy } = query.options
    const { onRequest, onData, onError } = callbacks

    this.cache.subscribe(query, onData)

    switch (fetchPolicy) {
      case "cache-first":
        // if (cache.hasDataForQuery(query)) {
        //
        // } else {
        this.fetcher.addRequest(query, {
          onComplete: (data) => this.cache.set(query, data),
          onRequest,
          onError,
        })
        // }
        break

      default:
        // prettier-ignore
        throw new Error(`[FNC] ${query.key} uses unsupported fetchPolicy: ${fetchPolicy}`)
    }
  }

  unregisterQuery<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>
  ) {
    this.cache.unsubscribe(query)
  }
}

export default StandardStore

import { InternalStore } from "../Store"
import { Query } from "../Query"
import Fetcher from "./Fetcher"
import InMemoryCache from "./cache/InMemoryCache"

class StandardStore implements InternalStore {
  private fetcher = new Fetcher()
  private cache = new InMemoryCache()

  registerQuery<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    callbacks: {
      onRequest: () => void
      onData: (data: TResult) => void
      onError: (err: Error) => void
    }
  ) {
    // makes sure query instance is unique, not shared among UI components
    const uniqueQuery = query.clone()
    const { onRequest, onData, onError } = callbacks

    const alreadyCached = this.cache.subscribe(uniqueQuery, onData)
    if (!alreadyCached) {
      this.fetcher.addRequest(uniqueQuery, {
        onStart: onRequest,
        onComplete: (data) => this.cache.storeFetchedData(uniqueQuery, data),
        onError,
      })
    }

    return {
      unsubscribe: () => this.cache.unsubscribe(uniqueQuery),
    }
  }
}

export default StandardStore

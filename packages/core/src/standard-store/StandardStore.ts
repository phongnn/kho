import { InternalStore } from "../Store"
import { Query } from "../Query"
import Fetcher from "./Fetcher"
import InMemoryCache from "./cache/InMemoryCache"

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
    const { onRequest, onData, onError } = callbacks

    const alreadyCached = this.cache.subscribe(query, onData)
    if (!alreadyCached) {
      this.fetcher.addRequest(query, {
        onStart: onRequest,
        onComplete: (data) => this.cache.storeData(query, data),
        onError,
      })
    }

    // const { fetchPolicy } = query.options
    // switch (fetchPolicy) {
    //   case "cache-first":
    //     break

    //   default:
    //     // prettier-ignore
    //     throw new Error(`[FNC] Unsupported fetchPolicy: ${fetchPolicy}`)
    // }
  }

  unregisterQuery<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>
  ) {
    this.cache.unsubscribe(query)
  }
}

export default StandardStore

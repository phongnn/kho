import { InternalStore } from "../Store"
import { Query } from "../Query"
import Fetcher from "./Fetcher"

class StandardStore implements InternalStore {
  private fetcher = new Fetcher()

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

    switch (fetchPolicy) {
      case "cache-first":
        // if (cache.hasDataForQuery(query)) {
        //   cache.subscribe(query, onData)
        // } else {
        this.fetcher.put(query, { onRequest, onError })
        // }
        break

      default:
        throw new Error(
          `[FNC] ${query.key} uses unsupported fetchPolicy: ${fetchPolicy}`
        )
    }
  }

  unregisterQuery<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>
  ) {
    // TODO: unsubscribe the active query
    // throw new Error("Method not implemented.")
  }
}

export default StandardStore

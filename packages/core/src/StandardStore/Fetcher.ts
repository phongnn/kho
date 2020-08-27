import { Query } from "../Query"

class Fetcher {
  put<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>,
    callbacks: {
      onRequest: () => void
      onError: (err: Error) => void
    }
  ) {
    const { fetcher, options } = query
    const args = (options.arguments || []) as TArguments
    callbacks.onRequest()
    fetcher(...args).catch(callbacks.onError)
  }
}

export default Fetcher

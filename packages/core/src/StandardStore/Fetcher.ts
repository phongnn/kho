import { Query } from "../Query"

class Fetcher {
  put<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>,
    callbacks: {
      onComplete: (data: TResult) => void
      onRequest?: () => void
      onError?: (err: Error) => void
    }
  ) {
    const { fetcher, options } = query
    const args = (options.arguments || []) as TArguments
    const { onRequest, onComplete, onError } = callbacks
    if (onRequest) {
      onRequest()
    }

    fetcher(...args)
      .then(onComplete)
      .catch(onError)
  }
}

export default Fetcher

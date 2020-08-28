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
      .catch((e) => this.handleError(e, onError))
  }

  private handleError(e: any, onError?: (err: Error) => void) {
    const err =
      e instanceof Error
        ? e
        : new Error(
            typeof e === "string" ? e : `[FNC] Error when fetching data: ${e}`
          )

    if (process.env.NODE_ENV !== "production") {
      console.error(err)
    }

    if (onError) {
      onError(err)
    }
  }
}

export default Fetcher

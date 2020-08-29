import { Query } from "../Query"
import { isProduction } from "../helpers"

class RequestInfo<TResult> {
  constructor(
    readonly completeCallback: (data: TResult) => void,
    readonly errorCallbacks: Array<(err: Error) => void> = [] // multiple callbacks for "dedup"-ed requests
  ) {}

  addErrorCallback(cb: (err: Error) => void) {
    this.errorCallbacks.push(cb)
  }
}

const toErrorObj = (e: any) =>
  e instanceof Error
    ? e
    : new Error(
        typeof e === "string"
          ? `[FNC Fetcher] ${e}`
          : `[FNC] Error when fetching data: ${e}`
      )

class Fetcher {
  private ongoingRequests = new Map<Query<any, any, any>, RequestInfo<any>>()

  addRequest<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    callbacks: {
      onComplete: (data: TResult) => void
      onStart?: () => void
      onError?: (err: Error) => void
    }
  ) {
    const { onStart, onError, onComplete } = callbacks
    if (onStart) {
      onStart()
    }

    const [_, ongoingReqInfo] = this.getMatchedOngoingRequest(query)
    if (ongoingReqInfo) {
      onError && ongoingReqInfo.addErrorCallback(onError)
    } else {
      const info = new RequestInfo(onComplete, onError ? [onError] : [])
      this.ongoingRequests.set(query, info)
      this.startFetching(query, info)
    }
  }

  private getMatchedOngoingRequest<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>
  ): [Query<TResult, TArguments, TContext>, RequestInfo<TResult>] | [] {
    for (let [q, reqInfo] of this.ongoingRequests) {
      if (query.key.matches(q.key)) {
        return [q, reqInfo]
      }
    }
    return []
  }

  private startFetching<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    requestInfo: RequestInfo<TResult>
  ) {
    const { fetcher, options } = query
    const { completeCallback, errorCallbacks } = requestInfo

    fetcher(options.arguments!, options.context!)
      .then(completeCallback)
      .catch((e) => {
        const err = toErrorObj(e)
        if (!isProduction) {
          console.error(err)
        }
        errorCallbacks.forEach((cb) => cb(err))
      })
      .finally(() => this.ongoingRequests.delete(query))
  }
}

export default Fetcher

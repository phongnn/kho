import { Query } from "../../query/Query"
import { isProduction } from "../../helpers"
import CompoundQuery from "./CompoundQuery"
import CompoundQueryHandler from "./CompoundQueryHandler"

class Fetcher {
  private ongoingRequests = new Map<Query<any, any, any>, RequestInfo<any>>()

  addRequest<TResult, TArguments, TContext>(
    query:
      | Query<TResult, TArguments, TContext>
      | CompoundQuery<TResult, TArguments, TContext>,
    callbacks: {
      onData: (data: TResult) => void
      onComplete?: () => void
      onRequest?: () => void
      onError?: (err: Error) => void
    }
  ) {
    const { onRequest, onError, onComplete, onData } = callbacks
    if (onRequest) {
      onRequest()
    }

    if (query instanceof Query) {
      this.handleRequest(query, { onError, onComplete, onData })
    } else {
      // prettier-ignore
      const handler = new CompoundQueryHandler(query, { onData, onError, onComplete })
      for (const childQuery of query) {
        this.handleRequest(childQuery, {
          onData: (data) => handler.handleData(childQuery, data),
          onError: (err) => handler.handleError(err),
        })
      }
    }
  }

  private handleRequest<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    callbacks: {
      onData: (data: TResult) => void
      onComplete?: () => void
      onError?: (err: Error) => void
    }
  ) {
    const { onData, onComplete, onError } = callbacks

    // dedup requests
    const [_, ongoingReqInfo] = this.getMatchedOngoingRequest(query)
    if (ongoingReqInfo) {
      if (onError || onComplete) {
        ongoingReqInfo.addCallbacks({ onError, onComplete })
      }
    } else {
      const info = new RequestInfo(
        onData,
        onError ? [onError] : [],
        onComplete ? [onComplete] : []
      )
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
    const { dataCallback, completeCallbacks, errorCallbacks } = requestInfo

    fetcher(options.arguments!, options.context!)
      .then((data) => {
        completeCallbacks.forEach((cb) => cb())
        dataCallback(data)
      })
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

class RequestInfo<TResult> {
  constructor(
    readonly dataCallback: (data: TResult) => void,
    readonly errorCallbacks: Array<(err: Error) => void>, // multiple callbacks for "dedup"-ed requests
    readonly completeCallbacks: Array<() => void> // multiple callbacks for "dedup"-ed requests
  ) {}

  /** for "dedup"-ed requests */
  addCallbacks({
    onError,
    onComplete,
  }: {
    onError?: (err: Error) => void
    onComplete?: () => void
  }) {
    if (onError) {
      this.errorCallbacks.push(onError)
    }
    if (onComplete) {
      this.completeCallbacks.push(onComplete)
    }
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

export default Fetcher

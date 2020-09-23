import { Query, CompoundQuery } from "../common"
import { isProduction } from "../common/helpers"
import CompoundQueryController from "./CompoundQueryController"

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
    },
    options?: { ignoreDedupOnData: boolean }
  ) {
    const { onRequest, onError, onComplete, onData } = callbacks

    if (onRequest) {
      onRequest()
    }

    if (query instanceof Query) {
      this.handleRequest(query, { onComplete, onData, onError }, options)
    } else {
      // prettier-ignore
      const handler = new CompoundQueryController(query, { onComplete, onData, onError })
      for (const childQuery of query) {
        this.handleRequest(
          childQuery,
          {
            onData: (data) => handler.handleData(childQuery, data),
            onError: (err) => handler.handleError(err),
          },
          { ignoreDedupOnData: false }
        )
      }
    }
  }

  private handleRequest<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    callbacks: {
      onData: (data: TResult) => void
      onComplete?: () => void
      onError?: (err: Error) => void
    },
    options: { ignoreDedupOnData?: boolean } = {}
  ) {
    const { onData, onComplete, onError } = callbacks
    const { ignoreDedupOnData = false } = options

    // dedup requests
    const [_, ongoingReqInfo] = this.getMatchedOngoingRequest(query)
    if (ongoingReqInfo) {
      if (onError || onComplete || !ignoreDedupOnData) {
        ongoingReqInfo.addCallbacks({
          onError,
          onComplete,
          onData: ignoreDedupOnData ? undefined : onData,
        })
      }
    } else {
      const info = new RequestInfo(
        [onData],
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
    const { dataCallbacks, completeCallbacks, errorCallbacks } = requestInfo

    fetcher(options.arguments!, options.context as TContext)
      .then((data) => {
        this.ongoingRequests.delete(query) // clean up before callbacks (can't use finally for this)
        dataCallbacks.forEach((cb) => cb(data))
        completeCallbacks.forEach((cb) => cb())
      })
      .catch((e) => {
        this.ongoingRequests.delete(query) // clean up before callbacks (can't use finally for this)
        const err = toErrorObj(e)
        if (!isProduction) {
          console.error(err)
        }
        errorCallbacks.forEach((cb) => cb(err))
      })
  }
}

class RequestInfo<TResult> {
  // multiple callbacks for "dedup"-ed requests
  constructor(
    readonly dataCallbacks: Array<(data: TResult) => void>,
    readonly errorCallbacks: Array<(err: Error) => void>,
    readonly completeCallbacks: Array<() => void>
  ) {}

  /** for "dedup"-ed requests */
  addCallbacks(callbacks: {
    onData?: (data: TResult) => void
    onError?: (err: Error) => void
    onComplete?: () => void
  }) {
    const { onData, onError, onComplete } = callbacks
    if (onData) {
      this.dataCallbacks.push(onData)
    }
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
          ? `[Kho Fetcher] ${e}`
          : `[Kho] Error when fetching data: ${e}`
      )

export default Fetcher

import { Query } from "../Query"
import { isProduction } from "../helpers"

interface QueryInfo {
  onData: (data: any) => void
}

class InMemoryCache {
  private queryMap = new Map<Query<any, any>, QueryInfo>()

  subscribe<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>,
    onData: (data: TResult) => void
  ) {
    this.queryMap.set(query, { onData })
  }

  unsubscribe<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>
  ) {
    if (this.queryMap.has(query)) {
      this.queryMap.delete(query)
    } else if (!isProduction) {
      console.error(`[FNC] Query not found to unsubscribe: ${query.key}`)
    }
  }

  set<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>,
    data: TResult
  ): void {
    // TODO: add data to state tree object
    // for each active query, compute data and invoke onData callback
    for (let queryInfo of this.queryMap.values()) {
      queryInfo.onData(data)
    }
  }
}

export default InMemoryCache

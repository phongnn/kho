import { Query } from "../Query"

class InMemoryCache {
  private callbacks: Record<string, (data: any) => void> = {}

  subscribe<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>,
    onData: (data: TResult) => void
  ) {
    this.callbacks[query.key] = onData
  }

  unsubscribe<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>
  ) {
    if (this.callbacks[query.key]) {
      delete this.callbacks[query.key]
    }
  }

  put<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>,
    data: TResult
  ): void {
    const cb = this.callbacks[query.key]
    if (cb) {
      cb(data)
    }
  }
}

export default InMemoryCache

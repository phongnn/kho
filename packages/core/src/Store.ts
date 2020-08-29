import { Query } from "./Query"

/** Public interface exposed to developers */
export interface Store {}

/** Interface exposed to view connectors (e.g., React hooks) */
export interface InternalStore extends Store {
  registerQuery<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>,
    callbacks: {
      onRequest: () => void
      onData: (data: TResult) => void
      onError: (err: Error) => void
    }
  ): Subscription
}

export interface StoreOptions {}

interface Subscription {
  unsubscribe: () => void
}

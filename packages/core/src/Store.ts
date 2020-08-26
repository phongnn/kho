import { FNCOptions } from "./types"
import { Query, QueryOptions } from "./Query"

/** Public interface exposed to developers */
export interface Store {}

/** Interface exposed to view connectors (e.g., React hooks) */
export interface InternalStore extends Store {
  registerQuery<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>,
    callbacks: {
      onData: (data: TResult) => void
      onError: (err: Error) => void
    },
    options?: QueryOptions<TArguments>
  ): void

  unregisterQuery<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>
  ): void
}

class BaseStore implements InternalStore {
  registerQuery<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>,
    callbacks: {
      onData: (data: TResult) => void
      onError: (err: Error) => void
    },
    options?: QueryOptions<TArguments>
  ) {
    throw new Error("Method not implemented.")
  }

  unregisterQuery<TResult, TArguments extends any[]>(
    query: Query<TResult, TArguments>
  ) {
    throw new Error("Method not implemented.")
  }
}

export function createStore(options?: FNCOptions): Store {
  return new BaseStore()
}

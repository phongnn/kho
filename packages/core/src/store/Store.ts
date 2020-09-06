import { Query } from "../query/Query"

/** Public interface exposed to developers */
export interface Store {}

/** Interface exposed to view connectors (e.g., React hooks) */
export interface InternalStore extends Store {
  registerQuery<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    callbacks: {
      onRequest?: () => void
      onError?: (err: Error) => void
      onComplete?: () => void
      onData: (data: TResult) => void
    }
  ): QueryRegistrationResult<TResult, TArguments, TContext>
}

export interface StoreOptions {}

export interface QueryRegistrationResult<TResult, TArguments, TContext> {
  unregister: () => void

  refetch: (callbacks?: {
    onRequest?: () => void
    onError?: (err: Error) => void
    onComplete?: () => void
  }) => void

  fetchMore: (
    query: Query<TResult, TArguments, TContext>,
    callbacks?: {
      onRequest?: () => void
      onError?: (err: Error) => void
      onComplete?: () => void
    }
  ) => void
}

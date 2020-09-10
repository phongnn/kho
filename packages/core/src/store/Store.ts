import { Query } from "../query/Query"
import { Mutation } from "../query/Mutation"
import { BaseQuery } from "../query/BaseQuery"
import { LocalQuery } from "../query/LocalQuery"

export interface StoreOptions {}

/** Public interface exposed to developers */
export interface Store {
  setQueryData(query: BaseQuery, data: any): void
  resetStore(): Promise<unknown>
  // clearStore(): void
}

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

  registerLocalQuery<TResult>(
    query: LocalQuery<TResult>,
    callbacks: {
      onData: (data: TResult) => void
    }
  ): LocalQueryRegistrationResult

  processMutation<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    callbacks?: {
      onRequest?: () => void
      onError?: (err: Error) => void
      onComplete?: (data: TResult) => void
    }
  ): void
}

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

  startPolling: (interval?: number) => void
  stopPolling: () => void
}

export interface LocalQueryRegistrationResult {
  unregister: () => void
}

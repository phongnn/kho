import { Store, Query, LocalQuery, Mutation, LocalMutation } from "../common"

/** Interface for use by view connectors, e.g. React hooks, NOT directly in the views */
export interface AdvancedStore extends Store {
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

  processLocalMutation<Input>(
    mutation: LocalMutation<Input>,
    callbacks?: {
      onComplete?: (data: Input) => void
      onError?: (err: Error) => void
    }
  ): void
}

export interface QueryRegistrationResult<TResult, TArguments, TContext> {
  unregister: () => void
  retry: () => void
  refetch: RefetchFn
  fetchMore: FetchMoreFn<TResult, TArguments, TContext>
}

export interface LocalQueryRegistrationResult {
  unregister: () => void
}

export interface RefetchFn {
  (callbacks?: {
    onRequest?: () => void
    onError?: (err: Error) => void
    onComplete?: () => void
  }): void
}

export interface FetchMoreFn<TResult, TArguments, TContext> {
  (
    query: Query<TResult, TArguments, TContext>,
    callbacks?: {
      onRequest?: () => void
      onError?: (err: Error) => void
      onComplete?: () => void
    }
  ): void
}

import { BaseQuery } from "../query/BaseQuery"
import { Query, QueryOptions } from "../query/Query"
import { LocalQuery } from "../query/LocalQuery"
import { Mutation, MutationOptions } from "../query/Mutation"

/** Public interface exposed to developers */
export interface Store {
  query<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    options?: Pick<
      QueryOptions<TResult, TArguments, TContext>,
      "arguments" | "context" | "fetchPolicy"
    >
  ): Promise<TResult>

  mutate<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    options?: Pick<
      MutationOptions<TResult, TArguments, TContext>,
      "arguments" | "context" | "optimisticResponse"
    >
  ): Promise<void>

  refetchQueries(queries: Query<any, any, any>[]): Promise<void>
  setQueryData(query: BaseQuery, data: any): void
  deleteQuery(query: BaseQuery): Promise<void>
  resetStore(): Promise<void>
}

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

export interface QueryRegistrationResult<TResult, TArguments, TContext> {
  unregister: () => void
  refetch: RefetchFn
  fetchMore: FetchMoreFn<TResult, TArguments, TContext>
  startPolling: (interval?: number) => void
  stopPolling: () => void
}

export interface LocalQueryRegistrationResult {
  unregister: () => void
}

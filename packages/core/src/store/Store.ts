import { Query, QueryOptions } from "../query/Query"
import { Mutation, MutationOptions } from "../query/Mutation"
import { LocalQuery } from "../query/LocalQuery"
import { BaseQuery } from "../query/BaseQuery"

export interface StoreOptions {}

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
      | "arguments"
      | "context"
      | "optimisticResponse"
      | "refetchQueries"
      | "refetchQueriesSync"
    >
  ): Promise<TResult>

  resetStore(): Promise<unknown>

  setQueryData(query: BaseQuery, data: any): void
  deleteQuery(query: BaseQuery): Promise<unknown>
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

export interface InternalRefetchFn {
  (callbacks?: {
    onRequest?: () => void
    onError?: (err: Error) => void
    onComplete?: () => void
  }): void
}

export interface InternalFetchMoreFn<TResult, TArguments, TContext> {
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
  refetch: InternalRefetchFn
  fetchMore: InternalFetchMoreFn<TResult, TArguments, TContext>
  startPolling: (interval?: number) => void
  stopPolling: () => void
}

export interface LocalQueryRegistrationResult {
  unregister: () => void
}

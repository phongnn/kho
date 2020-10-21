import { Query, QueryOptions } from "./query/Query"
import { LocalQuery } from "./query/LocalQuery"
import { Mutation, MutationOptions } from "./mutation/Mutation"
import { LocalMutation } from "./mutation/LocalMutation"

export interface StoreOptions {
  queryExpiryMs: number
}

/** Public interface exposed to developers */
export interface Store {
  options: StoreOptions

  /** queries data from backend and saves into cache */
  query<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    options?: Pick<
      QueryOptions<TResult, TArguments, TContext>,
      "arguments" | "context" | "fetchPolicy"
    >
  ): Promise<TResult>

  /** calls backend to mutate data then updates cache with the mutation's result */
  mutate<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    options?: Pick<
      MutationOptions<TResult, TArguments, TContext>,
      "arguments" | "context" | "optimisticResponse" | "syncMode"
    >
  ): Promise<TResult>

  /** updates cache without calling backend */
  mutateLocal<Input>(
    mutation: LocalMutation<Input>,
    options?: {
      input?: Input
      syncMode?: boolean
    }
  ): Promise<void>

  /** retrieves data from cache, doesn't call backend if data not available */
  getQueryData<TResult>(
    query: Query<TResult, any, any> | LocalQuery<TResult>
  ): TResult | undefined

  /** normalizes and stores data into cache */
  setQueryData<TResult>(
    query: Query<TResult, any, any> | LocalQuery<TResult>,
    data: TResult
  ): void

  /** refetches queries from backend (all matching queries will be called if arguments not provided or partially provided) */
  refetchQueries(queries: Query<any, any, any>[]): Promise<void>

  refetchActiveQueries(): Promise<void>

  /** clears cache, resets local queries to their initial values, then refetches remote active queries */
  resetStore(): Promise<void>
}

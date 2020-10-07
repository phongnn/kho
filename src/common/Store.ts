import { Query, QueryOptions } from "./query/Query"
import { LocalQuery } from "./query/LocalQuery"
import { Mutation, MutationOptions } from "./query/Mutation"

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
  ): Promise<TResult>

  getQueryData<TResult>(
    query: Query<TResult, any, any> | LocalQuery<TResult>
  ): TResult | undefined

  setQueryData<TResult>(
    query: Query<TResult, any, any> | LocalQuery<TResult>,
    data: TResult
  ): void

  refetchQueries(queries: Query<any, any, any>[]): Promise<void>
  resetStore(): Promise<void>
}

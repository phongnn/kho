import { LocalQuery } from "./LocalQuery"
import { Mutation, MutationOptions } from "./Mutation"
import { Query, QueryOptions } from "./Query"

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

  setQueryData<TResult>(
    query: Query<TResult, any, any> | LocalQuery<TResult>,
    data: TResult
  ): void

  refetchQueries(queries: Query<any, any, any>[]): Promise<void>
  deleteQuery(query: Query<any, any, any> | LocalQuery<any>): Promise<void>
  resetStore(): Promise<void>
}

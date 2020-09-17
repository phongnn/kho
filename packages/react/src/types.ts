import { Query } from "@fnc/core"

export interface FetchMoreFn<TResult, TArguments, TContext> {
  (options?: {
    arguments?: TArguments
    context?: TContext
    query?: Query<TResult, TArguments, TContext>
  }): void
}

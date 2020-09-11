import {
  NormalizedShape,
  NormalizedType,
} from "../normalization/NormalizedType"
import { BaseQuery } from "./BaseQuery"
import { mergeOptions } from "../helpers"
import { Query } from "./Query"

export interface FNCCache {
  // note: if the 2nd param can be either data for function,
  // developers won't get auto-suggestion when defining the function
  writeQuery(query: BaseQuery, fn: (params: { existingData: any }) => any): void

  evictObject(type: NormalizedType, key: any): void
}

export interface MutationUpdateFn {
  (cache: FNCCache, context: { data: any; optimistic: boolean }): void
}

export interface MutationOptions<TResult, TArguments, TContext> {
  arguments?: TArguments
  context?: Partial<TContext>
  shape?: NormalizedShape
  update?: MutationUpdateFn
  optimisticResponse?: any
  refetchQueries?: Query<any, any, any>[]
  refetchQueriesSync?: Query<any, any, any>[]
}

export class Mutation<TResult, TArguments, TContext> {
  constructor(
    readonly fn: (args: TArguments, ctx: TContext) => Promise<TResult>,
    readonly options: MutationOptions<TResult, TArguments, TContext> = {}
  ) {}

  withOptions(...args: Array<MutationOptions<TResult, TArguments, TContext>>) {
    return new Mutation(
      this.fn,
      args.reduce((tmp, opts) => mergeOptions(tmp, opts || {}), this.options)
    )
  }
}

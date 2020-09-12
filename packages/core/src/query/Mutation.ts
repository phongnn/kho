import {
  NormalizedShape,
  NormalizedType,
} from "../normalization/NormalizedType"
import { BaseQuery } from "./BaseQuery"
import { mergeOptions } from "../helpers"
import { Query } from "./Query"
import { NormalizedObjectRef } from "../normalization/NormalizedObject"

export interface FNCCache {
  readQuery(query: BaseQuery): any
  updateQuery(query: BaseQuery, data: any): void

  addObject(type: NormalizedType, data: any): NormalizedObjectRef
  findObjectRef(type: NormalizedType, key: any): NormalizedObjectRef | null
  readObject(ref: NormalizedObjectRef): any
  updateObject(ref: NormalizedObjectRef, data: any): void
  deleteObject(ref: NormalizedObjectRef): void
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

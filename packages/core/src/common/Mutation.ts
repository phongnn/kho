import {
  NormalizedShape,
  NormalizedType,
} from "../normalization/NormalizedType"
import { QueryUpdateInfoArgument } from "./BaseQuery"
import { mergeOptions } from "./helpers"
import { NormalizedObjectRef } from "../normalization/NormalizedObject"
import { Store } from "./Store"
import { Query } from "./Query"
import { LocalQuery } from "./LocalQuery"

/** Interface exposed for use only in mutations' beforeQueryUpdates() */
export interface CacheFacade {
  // prettier-ignore
  readQuery<TResult>(query: Query<TResult, any, any> | LocalQuery<TResult>): TResult
  addObject(type: NormalizedType, data: any): NormalizedObjectRef
  findObjectRef(type: NormalizedType, key: any): NormalizedObjectRef | null
  readObject(ref: NormalizedObjectRef): any
  updateObject(ref: NormalizedObjectRef, data: any): void
  deleteObject(ref: NormalizedObjectRef): void
}

export interface MutationOptions<TResult, TArguments, TContext> {
  arguments?: TArguments
  context?: Partial<TContext>
  shape?: NormalizedShape
  optimisticResponse?: any
  beforeQueryUpdates?: (
    cache: CacheFacade,
    info: Omit<QueryUpdateInfoArgument, "context">
  ) => any
  afterQueryUpdates?: (store: Store, info: QueryUpdateInfoArgument) => any
  syncMode?: boolean
}

export class Mutation<TResult, TArguments, TContext> {
  private static registry = new Map<string, (...args: any[]) => Promise<any>>()

  constructor(
    readonly name: string,
    readonly fn: (args: TArguments, ctx: TContext) => Promise<TResult>,
    readonly options: MutationOptions<TResult, TArguments, TContext> = {}
  ) {
    this.options.syncMode = options.syncMode ?? false

    // make sure a mutation name can't be registered with more than 1 function
    const prevFn = Mutation.registry.get(name)
    if (prevFn && prevFn !== fn) {
      throw new Error(
        `Mutation name "${name}" already registered with a different function.`
      )
    } else {
      Mutation.registry.set(name, fn)
    }
  }

  withOptions(...args: Array<MutationOptions<TResult, TArguments, TContext>>) {
    return new Mutation(
      this.name,
      this.fn,
      args.reduce((tmp, opts) => mergeOptions(tmp, opts || {}), this.options)
    )
  }
}

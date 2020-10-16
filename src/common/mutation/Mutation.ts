import { Store } from "../Store"
import { NormalizedShape } from "../normalization/NormalizedType"
import { mergeOptions } from "../helpers"
import { CacheProxy } from "./CacheProxy"

export interface MutationOptions<TResult, TArguments, TContext> {
  arguments?: TArguments
  context?: Partial<TContext>
  shape?: NormalizedShape
  optimisticResponse?: any

  beforeQueryUpdates?: (
    cache: CacheProxy,
    info: {
      mutationResult: any // normalized data
      mutationArgs: TArguments
      optimistic: boolean
    }
  ) => void

  afterQueryUpdates?: (
    store: Store,
    info: {
      mutationResult: TResult // original, not normalized data
      mutationArgs: TArguments
      optimistic: boolean
    }
  ) => void | Promise<any>

  syncMode?: boolean
}

export class Mutation<TResult, TArguments, TContext> {
  private static registry = new Map<string, (...args: any[]) => Promise<any>>()

  constructor(
    readonly name: string,
    readonly fn: (
      args: TArguments,
      ctx: TContext,
      store?: Store
    ) => Promise<TResult>,
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

import { Store } from "../Store"
import { NormalizedShape } from "../normalization/NormalizedType"
import { mergeOptions } from "../helpers"
import { CacheProxy } from "./CacheProxy"

export interface MutationOptions<TResult, TArguments, TContext> {
  // an object to pass through to the API call
  arguments?: TArguments

  // use this object to pass request headers and so on to the API call
  context?: Partial<TContext>

  // the shape of data received from backend (used for data normalization purposes)
  resultShape?: NormalizedShape

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
      mutationResult: TResult // original data from backend, not normalized data
      mutationArgs: TArguments
      optimistic: boolean
    }
  ) => void | Promise<any>

  // wait for afterQueryUpdates() to finish before calling onComplete?
  // default value is false (async mode by default)
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

  /** clones the mutation but overrides its options */
  withOptions(...args: Array<MutationOptions<TResult, TArguments, TContext>>) {
    return new Mutation(
      this.name,
      this.fn,
      args.reduce((tmp, opts) => mergeOptions(tmp, opts || {}), this.options)
    )
  }
}

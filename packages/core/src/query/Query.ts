import { deepEqual, mergeOptions } from "../helpers"
import { NormalizedShape } from "../normalization/NormalizedType"
import { BaseQueryKey, BaseQuery, QueryUpdateFn } from "./BaseQuery"

export interface QueryOptions<TResult, TArguments, TContext> {
  arguments?: TArguments
  context?: Partial<TContext>
  shape?: NormalizedShape
  merge?: (
    existingData: any,
    newData: any,
    info: {
      arguments: TArguments
      context: Partial<TContext>
    }
  ) => any
  mutations?: Record<string, QueryUpdateFn>
  fetchPolicy?: "cache-first" | "cache-and-network" | "network-only"
  pollInterval?: number
}

class QueryKey<TArguments> implements BaseQueryKey {
  constructor(private name: string, private args: TArguments) {}

  matches(qk: BaseQueryKey): boolean {
    if (!(qk instanceof QueryKey) || qk.name !== this.name) {
      return false
    } else {
      return deepEqual(qk.args, this.args)
    }
  }
}

export class Query<TResult, TArguments, TContext> extends BaseQuery {
  private static registry = new Map<string, (...args: any[]) => Promise<any>>()

  constructor(
    readonly name: string,
    readonly fetcher: (args: TArguments, ctx: TContext) => Promise<TResult>,
    // prettier-ignore
    readonly options: QueryOptions<TResult, TArguments, TContext> = {}
  ) {
    super(new QueryKey(name, options.arguments), options)
    this.options.fetchPolicy = options.fetchPolicy ?? "cache-first"
    this.options.pollInterval = options.pollInterval ?? 0

    // make sure a query name can't be registered with more than 1 fetcher function
    const prevFetcher = Query.registry.get(name)
    if (prevFetcher && prevFetcher !== fetcher) {
      throw new Error(
        `Query name "${name}" already registered with a different function.`
      )
    } else {
      Query.registry.set(name, fetcher)
    }
  }

  clone = () => new Query(this.name, this.fetcher, this.options)

  withOptions(...args: Array<QueryOptions<TResult, TArguments, TContext>>) {
    return new Query(
      this.name,
      this.fetcher,
      args.reduce((tmp, opts) => mergeOptions(tmp, opts || {}), this.options)
    )
  }
}

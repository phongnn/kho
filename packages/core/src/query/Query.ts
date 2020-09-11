import { deepEqual, mergeOptions } from "../helpers"
import { NormalizedShape } from "../normalization/NormalizedType"
import { BaseQueryKey, BaseQuery } from "./BaseQuery"

export interface QueryOptions<TResult, TArguments, TContext> {
  fetchPolicy?: "cache-first" | "cache-and-network" | "network-only"

  arguments?: TArguments
  context?: Partial<TContext>
  shape?: NormalizedShape
  pollInterval?: number
  merge?: (
    existingData: any,
    newData: any,
    info: {
      arguments: TArguments
      context: Partial<TContext>
    }
  ) => any
}

const defaultQueryOptions: QueryOptions<any, any, any> = {
  fetchPolicy: "cache-first",
  pollInterval: 0,
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
    readonly options: QueryOptions<TResult, TArguments, TContext> = defaultQueryOptions
  ) {
    super(new QueryKey(name, options.arguments), options)

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

  withOptions(options: QueryOptions<TResult, TArguments, TContext>) {
    return new Query(
      this.name,
      this.fetcher,
      mergeOptions(this.options, options)
    )
  }
}

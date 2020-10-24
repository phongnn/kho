// prettier-ignore
import { BaseQueryKey, BaseQuery, QueryUpdateFn, RelatedQueryUpdateFn } from "./BaseQuery"
import { Selector } from "../normalization/Selector"
// prettier-ignore
import { NormalizedShape, TransformShape } from "../normalization/NormalizedType"
import { deepEqual, mergeOptions } from "../helpers"

export interface QueryOptions<TResult, TArguments, TContext> {
  // an object to pass through to the API call
  arguments?: TArguments

  // use this object to pass request headers and so on to the API call
  context?: Partial<TContext>

  // when will this query's data expire and need to be refetched (if active) or removed (if inactive)?
  // default 15 minutes (15 * 60 * 1,000ms)
  expiryMs?: number

  // the shape of data received from backend (used for data normalization purposes)
  shape?: NormalizedShape

  // data transformation when reading data from cache
  transform?: TransformShape

  // executed when fetchMore() is invoked (e.g. infinite scroll).
  // its result will replace the existing data of the query in the cache
  merge?: (
    existingData: any, // normalized data
    newData: any, // normalized data
    info: { arguments: TArguments }
  ) => any

  // updates related queries upon receipt of this query's data
  queryUpdates?: Record<string, RelatedQueryUpdateFn>

  // default: "cache-first"
  fetchPolicy?: "cache-first" | "cache-and-network" | "network-only"

  // "selector" is only needed when the first request to backend may return blank result
  // AND you want to update this query's data from a related query/mutation (queryUpdates option)
  selector?: Selector
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

  matchesPlain(plainKey: any): boolean {
    const { type, name, args } = plainKey
    return type === "Query" && name === this.name && deepEqual(args, this.args)
  }

  plain = () => ({ type: "Query", name: this.name, args: this.args })
}

export class Query<TResult, TArguments, TContext> extends BaseQuery {
  private static registry = new Map<string, (...args: any[]) => Promise<any>>()

  constructor(
    readonly name: string,
    readonly fetcher: (args: TArguments, ctx: TContext) => Promise<TResult>,
    // prettier-ignore
    readonly options: QueryOptions<TResult, TArguments, TContext> = {}
  ) {
    super(new QueryKey(name, options.arguments), name, options)
    this.options.fetchPolicy = options.fetchPolicy ?? "cache-first"

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

  /** clones the query but overrides its options */
  withOptions(...args: Array<QueryOptions<TResult, TArguments, TContext>>) {
    return new Query(
      this.name,
      this.fetcher,
      args.reduce((tmp, opts) => mergeOptions(tmp, opts || {}), this.options)
    )
  }

  argumentsMatch(fullArgs: any): boolean {
    if (!fullArgs || !this.options.arguments) {
      return true
    }

    const partialArgs: any = {}
    Object.getOwnPropertyNames(this.options.arguments).forEach(
      (prop) => (partialArgs[prop] = fullArgs[prop])
    )
    return deepEqual(this.options.arguments, partialArgs)
  }
}

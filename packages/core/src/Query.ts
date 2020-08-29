import { deepEqual } from "./helpers"

export class QueryKey {
  static of(k: any) {
    return new QueryKey(k)
  }

  static fromString(s: string) {
    return new QueryKey(JSON.parse(s))
  }

  private constructor(private key: any) {}

  toString() {
    return JSON.stringify(this.key)
  }

  matches(qk: QueryKey) {
    return deepEqual(qk.key, this.key)
  }
}

export abstract class BaseQuery<TResult> {
  constructor(readonly key: QueryKey) {}
}

export interface QueryOptions<TArguments, TContext> {
  fetchPolicy?:
    | "cache-first"
    | "cache-and-network"
    | "network-only"
    | "cache-only"

  arguments?: TArguments
  context?: TContext
}

const defaultQueryOptions: QueryOptions<any, any> = {
  fetchPolicy: "cache-first",
}

export class Query<TResult, TArguments, TContext> extends BaseQuery<TResult> {
  constructor(
    readonly name: string,
    readonly fetcher: (args: TArguments, ctx: TContext) => Promise<TResult>,
    readonly options: QueryOptions<TArguments, TContext> = defaultQueryOptions
  ) {
    super(QueryKey.of({ name, arguments: options.arguments || [] }))
  }

  clone = () => new Query(this.name, this.fetcher, this.options)
}

export class LocalQuery<TResult> extends BaseQuery<TResult> {
  constructor(readonly name: string) {
    super(QueryKey.of({ name }))
  }
}

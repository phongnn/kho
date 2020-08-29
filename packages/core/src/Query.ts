import { deepEqual } from "./helpers"

export interface QueryOptions<TArguments extends any[]> {
  fetchPolicy?:
    | "cache-first"
    | "cache-and-network"
    | "network-only"
    | "cache-only"

  arguments?: TArguments
}

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

export abstract class BaseQuery {
  constructor(readonly key: QueryKey) {}
}

export class Query<TResult, TArguments extends any[]> extends BaseQuery {
  constructor(
    readonly name: string,
    readonly fetcher: (...args: TArguments) => Promise<TResult>,
    readonly options: QueryOptions<TArguments> = {
      fetchPolicy: "cache-first",
    }
  ) {
    super(QueryKey.of({ name, arguments: options.arguments || [] }))
  }
}

export class LocalQuery extends BaseQuery {
  constructor(readonly name: string) {
    super(QueryKey.of({ name }))
  }
}

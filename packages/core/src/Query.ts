import { deepEqual } from "./helpers"
import { NormalizedShape } from "./NormalizedType"

export interface QueryKey {
  matches(qk: QueryKey): boolean
}

export abstract class BaseQuery {
  constructor(
    readonly key: QueryKey,
    readonly options: {
      shape?: NormalizedShape
    }
  ) {}
}

export interface QueryOptions<TArguments, TContext> {
  fetchPolicy?:
    | "cache-first"
    | "cache-and-network"
    | "network-only"
    | "cache-only"

  arguments?: TArguments
  context?: TContext
  shape?: NormalizedShape
}

const defaultQueryOptions: QueryOptions<any, any> = {
  fetchPolicy: "cache-first",
}

class RemoteQueryKey<TArguments> implements QueryKey {
  constructor(private name: string, private args: TArguments) {}

  matches(qk: QueryKey): boolean {
    if (!(qk instanceof RemoteQueryKey) || qk.name !== this.name) {
      return false
    } else {
      return deepEqual(qk.args, this.args)
    }
  }
}

export class Query<TResult, TArguments, TContext> extends BaseQuery {
  constructor(
    readonly name: string,
    readonly fetcher: (args: TArguments, ctx: TContext) => Promise<TResult>,
    readonly options: QueryOptions<TArguments, TContext> = defaultQueryOptions
  ) {
    super(new RemoteQueryKey(name, options.arguments), options)
  }

  clone = () => new Query(this.name, this.fetcher, this.options)
}

export interface LocalQueryOptions {
  shape?: NormalizedShape
}

class LocalQueryKey implements QueryKey {
  constructor(private name: string) {}

  matches(qk: QueryKey): boolean {
    return qk instanceof LocalQueryKey && qk.name === this.name
  }
}

export class LocalQuery extends BaseQuery {
  constructor(readonly name: string, readonly options: LocalQueryOptions = {}) {
    super(new LocalQueryKey(name), options)
  }
}

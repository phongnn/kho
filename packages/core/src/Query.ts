export interface QueryOptions<TArguments extends any[]> {
  fetchPolicy?:
    | "cache-first"
    | "cache-and-network"
    | "network-only"
    | "cache-only"

  arguments?: TArguments
}

abstract class BaseQuery {
  constructor(readonly key: any) {}
}

export class Query<TResult, TArguments extends any[]> extends BaseQuery {
  constructor(
    readonly name_toberemoved: string,
    readonly fetcher: (...args: TArguments) => Promise<TResult>,
    readonly options: QueryOptions<TArguments> = {
      fetchPolicy: "cache-first",
    }
  ) {
    super({ fetcher, arguments: options.arguments || [] })
  }
}

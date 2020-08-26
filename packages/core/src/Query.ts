export interface QueryOptions<TArguments extends any[]> {
  fetchPolicy?:
    | "cache-first"
    | "cache-and-network"
    | "network-only"
    | "cache-only"
    | "no-cache"

  arguments?: TArguments
}

export class Query<TResult, TArguments extends any[]> {
  constructor(
    readonly key: string,
    readonly fetcher: (...args: TArguments) => Promise<TResult>,
    readonly options: QueryOptions<TArguments> = {
      fetchPolicy: "cache-first",
    }
  ) {}
}

import { FNCOptions, QueryOptions } from "./types"

const defaultQueryOptions: QueryOptions = {
  fetchPolicy: "cache-first",
}

export class Store {
  constructor(options: FNCOptions = {}) {}

  registerQuery<TResult, TArguments>(
    key: string,
    fn: (args: TArguments) => Promise<TResult>,
    options: QueryOptions = defaultQueryOptions
  ) {}
}

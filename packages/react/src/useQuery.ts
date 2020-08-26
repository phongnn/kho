import { QueryOptions } from "@fnc/core"

import { useStore } from "./Provider"

export function useQuery<TResult, TArguments>(
  key: string,
  fn: (args: TArguments) => Promise<TResult>,
  options?: QueryOptions
) {
  const store = useStore()
  store.registerQuery<TResult, TArguments>(key, fn, options)
}

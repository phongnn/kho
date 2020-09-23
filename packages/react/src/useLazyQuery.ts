import { useRef, useEffect } from "react"
import { QueryOptions, Query } from "@fnc/core"

import { useAdvancedStore } from "./Provider"
import {
  useDataLoadingState,
  DataLoadingState,
  registerQuery,
} from "./common/useDataLoadingState"

export function useLazyQuery<TResult, TArguments, TContext>(
  query: Query<TResult, TArguments, TContext>,
  options: Omit<
    QueryOptions<TResult, TArguments, TContext>,
    "shape" | "merge"
  > = {}
) {
  const store = useAdvancedStore()
  const { state, dispatch } = useDataLoadingState(query)

  const unregisterFn = useRef<() => void>()
  const originalOptions = options

  const fetchData = (
    options: Pick<
      QueryOptions<TResult, TArguments, TContext>,
      "arguments" | "context"
    > = {}
  ) => {
    if (unregisterFn.current) {
      unregisterFn.current() // clean up first, just in case user calls fetchData() more than once
    }

    const actualQuery = query.withOptions(originalOptions, options)
    unregisterFn.current = registerQuery(store, actualQuery, dispatch)
  }

  useEffect(() => unregisterFn.current, [unregisterFn.current])

  // prettier-ignore
  return [fetchData, state] as [typeof fetchData, DataLoadingState<TResult, TArguments, TContext>]
}

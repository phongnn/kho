import { useRef, useEffect } from "react"
import { QueryOptions, Query, InternalStore } from "@fnc/core"

import { useInternalStore } from "./Provider"
import { useDataLoadingState, registerQuery } from "./useDataLoadingState"
import { deepEqual } from "./helpers"

type QueryDependencyList = [
  InternalStore,
  Query<any, any, any>,
  QueryOptions<any, any, any> | undefined
]

function useCustomEffect(fn: () => void, dependencies: QueryDependencyList) {
  const depRef = useRef(dependencies)
  if (hasChanges(depRef.current, dependencies)) {
    depRef.current = dependencies
  }

  useEffect(fn, depRef.current)
}

function hasChanges(
  currentDeps: QueryDependencyList,
  newDeps: QueryDependencyList
) {
  const [cStore, cQuery, cOptions = {}] = currentDeps
  const [nStore, nQuery, nOptions = {}] = newDeps
  return (
    nStore !== cStore ||
    nQuery !== cQuery ||
    !deepEqual(nOptions.arguments, cOptions.arguments) // TODO: write compareQueryArguments
  )
}

export function useQuery<TResult, TArguments, TContext>(
  query: Query<TResult, TArguments, TContext>,
  options?: Omit<QueryOptions<TResult, TArguments, TContext>, "shape" | "merge">
) {
  const store = useInternalStore()
  const { state, dispatch } = useDataLoadingState(query)

  useCustomEffect(() => {
    const actualQuery = !options ? query : query.withOptions(options)
    return registerQuery(store, actualQuery, dispatch) // return unregister fn
  }, [store, query, options])

  return state
}

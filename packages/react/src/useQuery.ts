import { useRef, useEffect } from "react"
import { QueryOptions, Query, InternalStore } from "@fnc/core"

import { useInternalStore } from "./Provider"
import { useDataLoadingState, registerQuery } from "./useDataLoadingState"
import { deepEqual } from "./helpers"

type QueryDependencyList = [
  InternalStore,
  React.Dispatch<any>,
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
  const [cStore, cQuery, cDispatch, cOptions = {}] = currentDeps
  const [nStore, nQuery, nDispatch, nOptions = {}] = newDeps
  return (
    nStore !== cStore ||
    nQuery !== cQuery ||
    nDispatch !== cDispatch ||
    !deepEqual(nOptions.arguments, cOptions.arguments)
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
  }, [store, dispatch, query, options])

  return state
}

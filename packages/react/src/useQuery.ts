import { useReducer, Reducer, useEffect } from "react"
import { QueryOptions, Query } from "@fnc/core"

import { useStore } from "./Provider"

interface DataLoadingState<TData> {
  loading: boolean
  data: TData | null
  error: Error | null
}

type DataLoadingAction<TData> =
  | { type: "ACTION_REQUEST" }
  | { type: "ACTION_SUCCESS"; payload: TData }
  | { type: "ACTION_FAILURE"; payload: Error }

const initialState: DataLoadingState<any> = {
  loading: false,
  data: null,
  error: null,
}

export function useQuery<TResult, TArguments extends any[]>(
  query: Query<TResult, TArguments>,
  options?: QueryOptions<TArguments>
) {
  const store = useStore()
  const [{ data, loading, error }, dispatch] = useReducer<
    Reducer<DataLoadingState<TResult>, DataLoadingAction<TResult>>
  >((state, action) => {
    switch (action.type) {
      case "ACTION_REQUEST":
        return { loading: true, data: null, error: null }
      case "ACTION_SUCCESS":
        return { loading: false, data: action.payload, error: null }
      case "ACTION_FAILURE":
        return { loading: false, data: null, error: action.payload }
      default:
        return state
    }
  }, initialState)

  useEffect(() => () => store.unregisterQuery(query), [store, query])

  store.registerQuery<TResult, TArguments>(
    query,
    {
      onData: (data) => dispatch({ type: "ACTION_SUCCESS", payload: data }),
      onError: (err) => dispatch({ type: "ACTION_FAILURE", payload: err }),
    },
    options
  )

  return { loading, data, error }
}

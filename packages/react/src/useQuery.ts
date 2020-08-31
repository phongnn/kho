import { useReducer, Reducer } from "react"
import { QueryOptions, Query } from "@fnc/core"

import { useStore } from "./Provider"
import { useDeepCompareEffect } from "./helpers"

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

export function useQuery<TResult, TArguments, TContext>(
  query: Query<TResult, TArguments, TContext>,
  options?: Omit<QueryOptions<TArguments, TContext>, "shape">
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

  useDeepCompareEffect(() => {
    const { name, fetcher, options: defaultOpts } = query
    const actualQuery = !options
      ? query
      : new Query(name, fetcher, { ...defaultOpts, ...options })

    const subscription = store.registerQuery<TResult, TArguments, TContext>(
      actualQuery,
      {
        onRequest: () => dispatch({ type: "ACTION_REQUEST" }),
        onData: (data) => dispatch({ type: "ACTION_SUCCESS", payload: data }),
        onError: (err) => dispatch({ type: "ACTION_FAILURE", payload: err }),
      }
    )

    return () => subscription.unsubscribe()
  }, [store, query, options])

  return { loading, data, error }
}

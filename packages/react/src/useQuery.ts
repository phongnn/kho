import { useReducer, Reducer } from "react"
import { QueryOptions, Query } from "@fnc/core"

import { useStore } from "./Provider"
import { useDeepCompareEffect } from "./helpers"

interface FetchMoreFn<TResult, TArguments, TContext> {
  (options: {
    arguments?: TArguments
    context?: TContext
    query?: Query<TResult, TArguments, TContext>
  }): void
}

const defaultFetchMore = () => {
  throw new Error(
    `[react-fnc] fetchMore() can only be called after successful data loading.`
  )
}

interface DataLoadingState<TResult, TArguments, TContext> {
  loading: boolean
  data: TResult | null
  error: Error | null
  fetchMore: FetchMoreFn<TResult, TArguments, TContext>
  fetchingMore: boolean
  fetchMoreError: Error | null
}

type DataLoadingAction<TResult, TArguments, TContext> =
  | { type: "ACTION_REQUEST" }
  | { type: "ACTION_FAILURE"; payload: Error }
  | {
      type: "ACTION_SUCCESS"
      internalFetchMore: (
        nextQuery: Query<TResult, TArguments, TContext>,
        callbacks?: {
          onRequest?: () => void
          onError?: (err: Error) => void
          onComplete: () => void
        }
      ) => void
    }
  | { type: "ACTION_FETCH_MORE_REQUEST" }
  | { type: "ACTION_FETCH_MORE_ERROR"; payload: Error }
  | { type: "ACTION_FETCH_MORE_SUCCESS" }
  | { type: "ACTION_DATA"; payload: TResult }

const initialState: DataLoadingState<any, any, any> = {
  loading: false,
  data: null,
  error: null,
  fetchMore: defaultFetchMore,
  fetchingMore: false,
  fetchMoreError: null,
}

export function useQuery<TResult, TArguments, TContext>(
  query: Query<TResult, TArguments, TContext>,
  options?: Omit<QueryOptions<TResult, TArguments, TContext>, "shape">
) {
  const store = useStore()

  const [state, dispatch] = useReducer<
    Reducer<
      DataLoadingState<TResult, TArguments, TContext>,
      DataLoadingAction<TResult, TArguments, TContext>
    >
  >((state, action) => {
    switch (action.type) {
      case "ACTION_REQUEST":
        return { ...state, loading: true, error: null, data: null }
      case "ACTION_FAILURE":
        return { ...state, loading: false, data: null, error: action.payload }
      case "ACTION_SUCCESS":
        const { internalFetchMore } = action
        return {
          ...state,
          loading: false,
          fetchingMore: false,
          fetchMore: ({ arguments: args, context, query: anotherQuery }) => {
            const nextQuery = anotherQuery
              ? new Query(anotherQuery.name, anotherQuery.fetcher, {
                  ...anotherQuery.options,
                  arguments: args || anotherQuery.options.arguments,
                  // context: { ...anotherQuery.options.context, ...context } // TODO
                })
              : new Query(query.name, query.fetcher, {
                  ...query.options,
                  arguments: args || query.options.arguments,
                  // context: { ...anotherQuery.options.context, ...context } // TODO
                })

            // prettier-ignore
            internalFetchMore(nextQuery, {
              onRequest: () => dispatch({ type: "ACTION_FETCH_MORE_REQUEST" }),
              onError: (err) => dispatch({ type: "ACTION_FETCH_MORE_ERROR", payload: err }),
              onComplete: () => dispatch({ type: "ACTION_FETCH_MORE_SUCCESS" })
            })
          },
        }
      case "ACTION_FETCH_MORE_REQUEST":
        return { ...state, fetchingMore: true, fetchMoreError: null }
      case "ACTION_FETCH_MORE_ERROR":
        return { ...state, fetchingMore: false, fetchMoreError: action.payload }
      case "ACTION_FETCH_MORE_SUCCESS":
        return { ...state, fetchingMore: false }
      case "ACTION_DATA":
        return { ...state, data: action.payload }
      default:
        return state
    }
  }, initialState)

  useDeepCompareEffect(() => {
    const { name, fetcher, options: defaultOpts } = query
    const actualQuery = !options
      ? query
      : new Query(name, fetcher, { ...defaultOpts, ...options }) // TODO: merge context objects

    const { fetchMore: internalFetchMore, unregister } = store.registerQuery<
      TResult,
      TArguments,
      TContext
    >(actualQuery, {
      onRequest: () => dispatch({ type: "ACTION_REQUEST" }),
      onError: (err) => dispatch({ type: "ACTION_FAILURE", payload: err }),
      onComplete: () => dispatch({ type: "ACTION_SUCCESS", internalFetchMore }),
      onData: (data) => dispatch({ type: "ACTION_DATA", payload: data }),
    })

    return () => unregister()
  }, [store, query, options])

  return state
}

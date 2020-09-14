import { useReducer, Reducer } from "react"
import { InternalStore, Query } from "@fnc/core"

interface FetchMoreFn<TResult, TArguments, TContext> {
  (options?: {
    arguments?: TArguments
    context?: TContext
    query?: Query<TResult, TArguments, TContext>
  }): void
}

const defaultRefetch = () => {
  throw new Error(
    `[react-fnc] refetch() can only be called after successful data loading.`
  )
}

const defaultFetchMore = () => {
  throw new Error(
    `[react-fnc] fetchMore() can only be called after successful data loading.`
  )
}

export interface DataLoadingState<TResult, TArguments, TContext> {
  loading: boolean
  data: TResult | null
  error: Error | null
  fetchMore: FetchMoreFn<TResult, TArguments, TContext>
  fetchingMore: boolean
  fetchMoreError: Error | null
  refetch: () => void
  refetching: boolean
  refetchError: Error | null
}

type DataLoadingAction<TResult, TArguments, TContext> =
  | { type: "ACTION_REQUEST" }
  | { type: "ACTION_FAILURE"; payload: Error }
  | {
      type: "ACTION_SUCCESS"

      internalRefetch: (callbacks?: {
        onRequest?: () => void
        onError?: (err: Error) => void
        onComplete?: () => void
      }) => void

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
  | { type: "ACTION_FETCH_MORE_FAILURE"; payload: Error }
  | { type: "ACTION_FETCH_MORE_SUCCESS" }
  | { type: "ACTION_REFETCH_REQUEST" }
  | { type: "ACTION_REFETCH_FAILURE"; payload: Error }
  | { type: "ACTION_REFETCH_SUCCESS" }
  | { type: "ACTION_DATA"; payload: TResult }

const initialState: DataLoadingState<any, any, any> = {
  loading: false,
  data: null,
  error: null,
  fetchMore: defaultFetchMore,
  fetchingMore: false,
  fetchMoreError: null,
  refetch: defaultRefetch,
  refetching: false,
  refetchError: null,
}

export function useDataLoadingState<TResult, TArguments, TContext>(
  query: Query<TResult, TArguments, TContext>
) {
  const [state, dispatch] = useReducer<
    Reducer<
      DataLoadingState<TResult, TArguments, TContext>,
      DataLoadingAction<TResult, TArguments, TContext>
    >
  >((currentState, action) => {
    switch (action.type) {
      case "ACTION_REQUEST":
        return { ...initialState, loading: true }
      case "ACTION_FAILURE":
        return {
          ...currentState,
          loading: false,
          data: null,
          error: action.payload,
        }
      case "ACTION_SUCCESS":
        const { internalFetchMore, internalRefetch } = action
        return {
          ...currentState,
          loading: false,
          refetch: () =>
            internalRefetch({
              onRequest: () => dispatch({ type: "ACTION_REFETCH_REQUEST" }),
              onError: (err) =>
                dispatch({ type: "ACTION_REFETCH_FAILURE", payload: err }),
              onComplete: () => dispatch({ type: "ACTION_REFETCH_SUCCESS" }),
            }),
          // prettier-ignore
          fetchMore: ({ arguments: args, context, query: anotherQuery } = {}) => {
            const nextQuery = (anotherQuery || query).withOptions({
              arguments: args,
              context,
            })

            internalFetchMore(nextQuery, {
              onRequest: () => dispatch({ type: "ACTION_FETCH_MORE_REQUEST" }),
              onError: (err) => dispatch({ type: "ACTION_FETCH_MORE_FAILURE", payload: err }),
              onComplete: () => dispatch({ type: "ACTION_FETCH_MORE_SUCCESS" })
            })
          },
        }
      case "ACTION_FETCH_MORE_REQUEST":
        return { ...currentState, fetchingMore: true, fetchMoreError: null }
      case "ACTION_FETCH_MORE_FAILURE":
        return {
          ...currentState,
          fetchingMore: false,
          fetchMoreError: action.payload,
        }
      case "ACTION_FETCH_MORE_SUCCESS":
        return { ...currentState, fetchingMore: false }
      case "ACTION_REFETCH_REQUEST":
        return { ...currentState, refetching: true, refetchError: null }
      case "ACTION_REFETCH_FAILURE":
        return {
          ...currentState,
          refetching: false,
          refetchError: action.payload,
        }
      case "ACTION_REFETCH_SUCCESS":
        return { ...currentState, refetching: false }
      case "ACTION_DATA":
        return { ...currentState, data: action.payload }
      default:
        return currentState
    }
  }, initialState)

  return { state, dispatch }
}

export function registerQuery<TResult, TArguments, TContext>(
  store: InternalStore,
  query: Query<TResult, TArguments, TContext>,
  dispatch: React.Dispatch<DataLoadingAction<TResult, TArguments, TContext>>
) {
  // prettier-ignore
  const { unregister, fetchMore, refetch } = store.registerQuery<TResult, TArguments, TContext>(
    query, 
    {
      onRequest: () => dispatch({ type: "ACTION_REQUEST" }),
      onError: (err) => dispatch({ type: "ACTION_FAILURE", payload: err }),
      onComplete: () =>
        dispatch({
          type: "ACTION_SUCCESS",
          internalFetchMore: fetchMore,
          internalRefetch: refetch,
        }),
      onData: (data) => dispatch({ type: "ACTION_DATA", payload: data }),
    }
  )
  return unregister
}

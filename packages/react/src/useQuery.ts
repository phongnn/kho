import { useReducer, Reducer, useRef, useEffect } from "react"
import { QueryOptions, Query, InternalStore } from "@fnc/core"

import { useStore } from "./Provider"
import { deepEqual } from "./helpers"

interface FetchMoreFn<TResult, TArguments, TContext> {
  (options: {
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

interface DataLoadingState<TResult, TArguments, TContext> {
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

function useCustomState<TResult, TArguments, TContext>(
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
        return { ...currentState, loading: true, error: null, data: null }
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
          fetchMore: ({ arguments: args, context, query: anotherQuery }) => {
            const nextQuery = (anotherQuery || query).withOptions({
              arguments: args,
              context,
            })

            // prettier-ignore
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

//----------- useCustomEffect ---------------
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

//----------- useQuery ---------------
export function useQuery<TResult, TArguments, TContext>(
  query: Query<TResult, TArguments, TContext>,
  options?: Omit<QueryOptions<TResult, TArguments, TContext>, "shape" | "merge">
) {
  const store = useStore()
  const { state, dispatch } = useCustomState(query)

  useCustomEffect(() => {
    const actualQuery = !options ? query : query.withOptions(options)
    // prettier-ignore
    const { unregister, fetchMore, refetch } = store.registerQuery<TResult, TArguments, TContext>(
      actualQuery, 
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
    return () => unregister()
  }, [store, query, options])

  return state
}

import { Reducer, useCallback, useEffect, useReducer } from "react"
import {
  InternalFetchMoreFn,
  InternalRefetchFn,
  Query,
  QueryOptions,
} from "@fnc/core"

import { useInternalStore } from "./Provider"
import { FetchMoreFn } from "./types"

export interface CustomState<TResult> {
  data: TResult
  fetchingMore: boolean
  fetchMoreError: Error | null
  refetching: boolean
  refetchError: Error | null
}

type CustomAction<TResult> =
  | { type: "ACTION_FETCH_MORE_REQUEST" }
  | { type: "ACTION_FETCH_MORE_FAILURE"; payload: Error }
  | { type: "ACTION_FETCH_MORE_SUCCESS" }
  | { type: "ACTION_REFETCH_REQUEST" }
  | { type: "ACTION_REFETCH_FAILURE"; payload: Error }
  | { type: "ACTION_REFETCH_SUCCESS" }
  | { type: "ACTION_DATA"; payload: TResult }

export function useCustomState<TResult>(initialData: TResult) {
  const initialState: CustomState<TResult> = {
    data: initialData,
    fetchingMore: false,
    fetchMoreError: null,
    refetching: false,
    refetchError: null,
  }

  const [state, dispatch] = useReducer<
    Reducer<CustomState<TResult>, CustomAction<TResult>>
  >((currentState, action) => {
    switch (action.type) {
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

interface SuspenseQueryEntry<TResult, TArguments, TContext> {
  unregister: () => void
  refetch: InternalRefetchFn
  fetchMore: InternalFetchMoreFn<TResult, TArguments, TContext>
  promise?: Promise<void>
  error?: Error
  data?: TResult
  onData?: (data: TResult) => void
}
// prettier-ignore
const suspenseQueryRegistry = new Map<string, SuspenseQueryEntry<any, any, any>>()

export function useSuspenseQuery<TResult, TArguments, TContext>(
  key: string,
  query: Query<TResult, TArguments, TContext>,
  options?: Omit<QueryOptions<TResult, TArguments, TContext>, "shape" | "merge">
) {
  const store = useInternalStore()
  const realQuery = !options ? query : query.withOptions(options)

  const existingEntry = suspenseQueryRegistry.get(key)
  if (!existingEntry) {
    const promise = new Promise<void>((resolve) => {
      // prettier-ignore
      const { unregister, fetchMore, refetch } = store.registerQuery<TResult, TArguments, TContext>(
        realQuery, 
        {
          onError: (err) => {
            // setTimeout because this might be called before registerQuery() returns
            setTimeout(() => {
              const entry = suspenseQueryRegistry.get(key)!
              entry.promise = undefined
              entry.error = err
              resolve()
            })
          },
          onData: (data) => {
            const entry = suspenseQueryRegistry.get(key)
            if (entry?.onData) {
              entry.onData(data)
            } else {
              // setTimeout because this might be called before registerQuery() returns
              setTimeout(() => {
                const e = suspenseQueryRegistry.get(key)!
                e.promise = undefined
                e.data = data
                resolve()
              })
            }
          }
        }
      )

      // prettier-ignore
      suspenseQueryRegistry.set(key, { unregister, fetchMore, refetch })
    })

    suspenseQueryRegistry.get(key)!.promise = promise.catch()
    throw promise.catch()
  } else if (existingEntry.promise) {
    throw existingEntry.promise
  } else if (existingEntry.error) {
    throw existingEntry.error
  }

  useEffect(
    () => () => {
      suspenseQueryRegistry.get(key)?.unregister()
      suspenseQueryRegistry.delete(key)
    },
    [key]
  )

  const { state, dispatch } = useCustomState<TResult>(existingEntry.data)
  const refetch = useCallback(
    () =>
      existingEntry.refetch({
        onRequest: () => dispatch({ type: "ACTION_REFETCH_REQUEST" }),
        onError: (err) =>
          dispatch({ type: "ACTION_REFETCH_FAILURE", payload: err }),
        onComplete: () => dispatch({ type: "ACTION_REFETCH_SUCCESS" }),
      }),
    [existingEntry]
  )
  const fetchMore = useCallback(
    ({ arguments: args, context, query: anotherQuery } = {}) => {
      // prettier-ignore
      const nextQuery = (anotherQuery || realQuery).withOptions({ arguments: args, context })
      existingEntry.fetchMore(nextQuery, {
        onRequest: () => dispatch({ type: "ACTION_FETCH_MORE_REQUEST" }),
        onError: (err) =>
          dispatch({ type: "ACTION_FETCH_MORE_FAILURE", payload: err }),
        onComplete: () => dispatch({ type: "ACTION_FETCH_MORE_SUCCESS" }),
      })
    },
    [existingEntry]
  )

  if (!existingEntry.onData) {
    existingEntry.onData = (data: TResult) =>
      dispatch({ type: "ACTION_DATA", payload: data })
  }

  return {
    ...state,
    refetch,
    fetchMore: fetchMore as FetchMoreFn<TResult, TArguments, TContext>,
  }
}

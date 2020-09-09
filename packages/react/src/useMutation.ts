import { useReducer, Reducer } from "react"
import { MutationOptions, Mutation } from "@fnc/core"

import { useStore } from "./Provider"

interface MutationState {
  loading: boolean
  error: Error | null
  called: boolean
}

type MutationAction =
  | { type: "ACTION_REQUEST" }
  | { type: "ACTION_FAILURE"; payload: Error }
  | { type: "ACTION_SUCCESS" }

const initialState: MutationState = {
  loading: false,
  error: null,
  called: false,
}

function useCustomState() {
  const [state, dispatch] = useReducer<Reducer<MutationState, MutationAction>>(
    (currentState, action) => {
      switch (action.type) {
        case "ACTION_REQUEST":
          return { loading: true, error: null, called: false }
        case "ACTION_FAILURE":
          return { loading: false, called: true, error: action.payload }
        case "ACTION_SUCCESS":
          return { loading: false, called: true, error: null }
        default:
          return currentState
      }
    },
    initialState
  )

  return { state, dispatch }
}

export function useMutation<TResult, TArguments, TContext>(
  mutation: Mutation<TResult, TArguments, TContext>,
  options: Omit<
    MutationOptions<TResult, TArguments, TContext>,
    "shape" | "update"
  > = {}
) {
  const store = useStore()
  const { state, dispatch } = useCustomState()
  const originalOptions = options

  const mutate = (
    options: Pick<
      MutationOptions<TResult, TArguments, TContext>,
      "arguments" | "context"
    > = {}
  ) => {
    const actualMutation = mutation.withOptions(originalOptions, options)
    store.processMutation(actualMutation, {
      onRequest: () => dispatch({ type: "ACTION_REQUEST" }),
      onError: (err) => dispatch({ type: "ACTION_FAILURE", payload: err }),
      onComplete: (data) => dispatch({ type: "ACTION_SUCCESS" }),
    })
  }

  return [mutate, state] as [typeof mutate, MutationState]
}

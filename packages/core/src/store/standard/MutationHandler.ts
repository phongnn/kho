import CacheController from "./CacheController"
import { Mutation } from "../../query/Mutation"
import { isProduction } from "../../helpers"

class MutationHandler {
  constructor(private cache: CacheController) {}

  processMutation<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    callbacks: {
      onRequest?: () => void
      onError?: (err: Error) => void
      onComplete?: (data: TResult) => void
    } = {}
  ) {
    const { fn, options } = mutation
    const { onRequest, onError, onComplete } = callbacks

    if (onRequest) {
      onRequest()
    }

    if (options.optimisticResponse) {
      setTimeout(() =>
        this.cache.storeMutationResult(
          mutation,
          options.optimisticResponse,
          true
        )
      )
    }

    fn(options.arguments!, options.context as TContext)
      .then((data) => {
        this.cache.storeMutationResult(mutation, data)
        if (onComplete) {
          onComplete(data)
        }
      })
      .catch((e) => {
        const err = toErrorObj(e)
        if (!isProduction) {
          console.error(err)
        }
        if (onError) {
          onError(err)
        }
      })
  }
}

const toErrorObj = (e: any) =>
  e instanceof Error
    ? e
    : new Error(
        typeof e === "string"
          ? `[FNC mutation handler] ${e}`
          : `[FNC] Error when mutating data: ${e}`
      )

export default MutationHandler

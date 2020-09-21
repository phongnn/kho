import CacheController from "./CacheController"
import { Mutation } from "../../query/Mutation"
import { isProduction } from "../../helpers"
import { QueryUpdateInfoArgument } from "../../query/BaseQuery"

class MutationHandler {
  constructor(private cache: CacheController) {}

  processMutation<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    callbacks: {
      onRequest?: () => void
      onError?: (err: Error) => void
      onComplete: (info: QueryUpdateInfoArgument) => void
    }
  ) {
    const { fn, options } = mutation
    const { onRequest, onError, onComplete } = callbacks

    if (onRequest) {
      onRequest()
    }

    // ignore the optimistic response if the real response is immediately available
    // (because of setTimeout(), optimistic response could be processed AFTER the real response)
    let done = false

    if (options.optimisticResponse) {
      setTimeout(
        () =>
          !done &&
          this.cache.storeMutationResult(
            mutation,
            options.optimisticResponse,
            true
          )
      )
    }

    fn(options.arguments!, options.context as TContext)
      .then((data) => {
        done = true // note: we can't use finally clause for this
        const info = this.cache.storeMutationResult(mutation, data)
        onComplete(info)
      })
      .catch((e) => {
        done = true // note: we can't use finally clause for this
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

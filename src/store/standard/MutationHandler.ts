import CacheController from "./CacheController"
import { Store, Mutation, LocalMutation } from "../../common"
import { isProduction } from "../../common/helpers"

class MutationHandler {
  constructor(private store: Store, private cache: CacheController) {}

  process<TResult, TArguments, TContext>(
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

    // ignore the optimistic response if the real response is immediately available
    // (because of setTimeout(), optimistic response could be processed AFTER the real response)
    let done = false

    if (options.optimisticResponse) {
      setTimeout(() => {
        if (done) {
          return
        }

        this.cache.storeMutationData(mutation, options.optimisticResponse, true)

        if (options.afterQueryUpdates) {
          const x = options.afterQueryUpdates(this.store, {
            mutationResult: options.optimisticResponse,
            mutationArgs: options.arguments!,
            optimistic: true,
          })
          if (x && x.then) {
            x.catch((e) => console.error(e))
          }
        }
      })
    }

    fn(options.arguments!, options.context as TContext, this.store)
      .then((data) => {
        done = true // note: we can't use finally clause for this
        this.cache.storeMutationData(mutation, data)

        const { afterQueryUpdates, syncMode = false } = options
        if (afterQueryUpdates) {
          const info = {
            mutationResult: data,
            mutationArgs: options.arguments!,
            optimistic: false,
          }

          if (syncMode) {
            const x = afterQueryUpdates(this.store, info)
            if (x && x.then) {
              return x.then(onComplete, onError)
            }
          } else {
            setTimeout(() => {
              const x = afterQueryUpdates(this.store, info)
              if (x && x.then) {
                x.catch((e) => console.error(e))
              }
            })
          }
        }

        if (onComplete) {
          onComplete(data)
        }
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

  processLocal<Input>(
    mutation: LocalMutation<Input>,
    callbacks: {
      onComplete?: () => void
      onError?: (err: Error) => void
    } = {}
  ) {
    const { input, syncMode = false, afterQueryUpdates } = mutation.options
    const { onComplete, onError } = callbacks

    try {
      this.cache.storeMutationData(mutation, input!)
    } catch (e) {
      const err = toErrorObj(e)
      if (!isProduction) {
        console.error(err)
      }
      if (onError) {
        onError(err)
      }
      return
    }

    if (afterQueryUpdates) {
      const info = { mutationInput: input! }

      if (syncMode) {
        const x = afterQueryUpdates(this.store, info)
        if (x && x.then) {
          return x.then(onComplete, onError)
        }
      } else {
        setTimeout(() => {
          const x = afterQueryUpdates(this.store, info)
          if (x && x.then) {
            x.catch((e) => console.error(e))
          }
        })
      }
    }

    if (onComplete) {
      onComplete()
    }
  }
}

const toErrorObj = (e: any) =>
  e instanceof Error
    ? e
    : new Error(
        typeof e === "string"
          ? `[Kho mutation handler] ${e}`
          : `[Kho] Error when mutating data: ${e}`
      )

export default MutationHandler

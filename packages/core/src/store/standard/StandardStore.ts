import { InternalStore } from "../Store"
import { Query } from "../../query/Query"
import { Mutation } from "../../query/Mutation"
import CacheController from "./CacheController"
import QueryHandler from "./QueryHandler"
import MutationHandler from "./MutationHandler"

class StandardStore implements InternalStore {
  private cache = new CacheController()
  private queryHandler = new QueryHandler(this.cache)
  private mutationHandler = new MutationHandler(this.cache)

  registerQuery<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    callbacks: {
      onData: (data: TResult) => void
      onRequest?: () => void
      onError?: (err: Error) => void
      onComplete?: () => void
    }
  ) {
    return this.queryHandler.registerQuery(query, callbacks)
  }

  processMutation<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    callbacks: {
      onRequest?: () => void
      onError?: (err: Error) => void
      onComplete?: (data: TResult) => void
    } = {}
  ) {
    const { onRequest, onError, onComplete } = callbacks
    this.mutationHandler.processMutation(mutation, {
      onRequest,
      onError,
      onComplete: (data: TResult) => {
        const { refetchQueries } = mutation.options
        if (refetchQueries) {
          setTimeout(() =>
            refetchQueries.forEach((query) => this.queryHandler.refetch(query))
          )
        }

        if (onComplete) {
          onComplete(data)
        }
      },
    })
  }
}

export default StandardStore

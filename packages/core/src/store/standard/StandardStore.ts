import { InternalStore } from "../Store"
import { Query } from "../../query/Query"
import { Mutation } from "../../query/Mutation"
import CacheController from "./CacheController"
import QueryHandler from "./QueryHandler"
import MutationHandler from "./MutationHandler"
import CompoundQuery from "../../fetcher/CompoundQuery"

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
        // prettier-ignore
        const { refetchQueries, refetchQueriesSync: syncQueries } = mutation.options
        if (refetchQueries) {
          // TODO: refetch relevant compound queries that are currently in cache (not only the active ones)
          setTimeout(() =>
            refetchQueries.forEach((query) => this.queryHandler.refetch(query))
          )
        }

        if (syncQueries) {
          // TODO: refetch relevant compound queries that are currently in cache (not only the active ones)
          setTimeout(() =>
            this.refetchQueriesSync(
              syncQueries,
              () => onComplete && onComplete(data),
              onError
            )
          )
        } else if (onComplete) {
          onComplete(data)
        }
      },
    })
  }

  resetStore() {
    return new Promise((resolve) => {
      this.cache.reset((activeQueries) => {
        let doneCount = 0
        const cbHandler = () => {
          doneCount++
          if (doneCount === activeQueries.length) {
            resolve()
          }
        }

        for (const query of activeQueries) {
          if (query instanceof Query || query instanceof CompoundQuery) {
            this.queryHandler.refetch(query, {
              onComplete: cbHandler,
              onError: cbHandler,
            })
          }
        }
      })
    })
  }

  // clearStore() {
  //   this.cache.clear()
  // }

  private refetchQueriesSync(
    queries: Query<any, any, any>[],
    onComplete: () => void,
    onError?: (err: Error) => void
  ) {
    let hasError = false
    let count = 0
    queries.forEach((query) =>
      this.queryHandler.refetch(query, {
        onComplete: () => {
          if (++count === queries.length) {
            onComplete()
          }
        },
        onError: (err) => {
          if (!hasError) {
            hasError = true
            if (onError) {
              onError(err)
            }
          }
        },
      })
    )
  }
}

export default StandardStore

import { InternalStore } from "../Store"
import { Query, QueryOptions } from "../../query/Query"
import { Mutation } from "../../query/Mutation"
import CacheController from "./CacheController"
import QueryHandler from "./QueryHandler"
import MutationHandler from "./MutationHandler"
import CompoundQuery from "../../fetcher/CompoundQuery"
import { BaseQuery } from "../../query/BaseQuery"
import { LocalQuery } from "../../query/LocalQuery"
import { getActualQuery } from "../../helpers"

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

  registerLocalQuery<TResult>(
    query: LocalQuery<TResult>,
    callbacks: {
      onData: (data: TResult) => void
    }
  ) {
    // makes sure query instance is unique, not shared among UI components
    const uniqueQuery = query.clone()
    this.cache.subscribe(uniqueQuery, callbacks.onData)
    return {
      unregister: () => this.cache.unsubscribe(uniqueQuery),
    }
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
          // prettier-ignore
          const [activeQueries, inactiveQueries] = this.separateInactiveQueries(refetchQueries)
          this.cache.removeInactiveQueries(inactiveQueries)
          setTimeout(() => {
            activeQueries.forEach((q) =>
              // @ts-ignore
              this.queryHandler.refetch(q, {
                onData: (data) => this.cache.storeQueryData(q, data),
              })
            )
          })
        }

        if (syncQueries) {
          // prettier-ignore
          const [activeQueries, inactiveQueries] = this.separateInactiveQueries(syncQueries)
          this.cache.removeInactiveQueries(inactiveQueries)
          if (activeQueries.length > 0) {
            this.refetchQueriesSync(
              // @ts-ignore
              activeQueries,
              () => onComplete && onComplete(data),
              onError
            )
            return
          }
        }

        if (onComplete) {
          onComplete(data)
        }
      },
    })
  }

  query<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    options: Pick<
      QueryOptions<TResult, TArguments, TContext>,
      "arguments" | "context" | "fetchPolicy"
    > = {}
  ) {
    const effectiveQuery = query.withOptions(options)
    const actualQuery = getActualQuery(effectiveQuery)

    const networkOnly = effectiveQuery.options.fetchPolicy === "network-only"
    return this.queryHandler.fetchQuery(actualQuery, networkOnly)
  }

  setQueryData(query: BaseQuery, data: any): void {
    this.cache.storeQueryData(query, data)
  }

  resetStore() {
    return new Promise((resolve) => {
      this.cache.reset((queriesToRefetch) => {
        let doneCount = 0
        const cbHandler = () => {
          doneCount++
          if (doneCount === queriesToRefetch.length) {
            resolve()
          }
        }

        for (const query of queriesToRefetch) {
          this.queryHandler.refetch(query, {
            onData: (data) => this.cache.storeQueryData(query, data),
            onComplete: cbHandler,
            onError: cbHandler,
          })
        }
      })
    })
  }

  private separateInactiveQueries(queries: Array<Query<any, any, any>>) {
    const activeQueries: BaseQuery[] = []
    const inactiveQueries: BaseQuery[] = []
    queries.forEach((query) => {
      // prettier-ignore
      const actualQuery = getActualQuery(query)
      const activeQuery = this.cache.findActiveQuery(actualQuery)
      if (activeQuery) {
        activeQueries.push(activeQuery)
      } else {
        inactiveQueries.push(actualQuery)
      }
    })

    return [activeQueries, inactiveQueries]
  }

  private refetchQueriesSync(
    queries: Array<Query<any, any, any> | CompoundQuery<any, any, any>>,
    onComplete: () => void,
    onError?: (err: Error) => void
  ) {
    let hasError = false
    let count = 0
    queries.forEach((query) =>
      this.queryHandler.refetch(query, {
        onData: (data) => this.cache.storeQueryData(query, data),
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

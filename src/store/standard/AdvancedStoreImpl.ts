import {
  Query,
  QueryOptions,
  LocalQuery,
  CompoundQuery,
  Mutation,
  MutationOptions,
} from "../../common"
import { getActualQuery } from "../../common/helpers"
import { AdvancedStore } from "../AdvancedStore"
import CacheController from "./CacheController"
import QueryHandler from "./QueryHandler"
import MutationHandler from "./MutationHandler"

class AdvancedStoreImpl implements AdvancedStore {
  private cache = new CacheController()
  private queryHandler = new QueryHandler(this.cache)
  private mutationHandler = new MutationHandler(this, this.cache)

  //========== AdvancedStore interface's methods =============

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
    this.mutationHandler.processMutation(mutation, callbacks)
  }

  //========== Store interface's methods =============

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

  mutate<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    options: Pick<
      MutationOptions<TResult, TArguments, TContext>,
      "arguments" | "context" | "optimisticResponse"
    > = {}
  ) {
    const actualMutation = mutation.withOptions(options)
    return new Promise<TResult>((resolve, reject) => {
      this.processMutation(actualMutation, {
        onComplete: resolve,
        onError: reject,
      })
    })
  }

  getQueryData<TResult>(query: Query<TResult, any, any> | LocalQuery<TResult>) {
    const actualQuery = query instanceof Query ? getActualQuery(query) : query
    return this.cache.retrieveQueryData(actualQuery) as TResult | undefined
  }

  setQueryData<TResult>(
    query: Query<TResult, any, any> | LocalQuery<TResult>,
    data: TResult
  ) {
    const actualQuery = query instanceof Query ? getActualQuery(query) : query
    this.cache.storeQueryData(actualQuery, data)
  }

  refetchQueries(queries: Query<any, any, any>[]) {
    return new Promise<void>((resolve, reject) => {
      const [activeQueries, inactiveQueries] = this.separateInactiveQueries(
        queries.map((q) => getActualQuery(q))
      )
      this.cache.removeInactiveQueries(inactiveQueries)
      if (activeQueries.length === 0) {
        return resolve()
      }

      let hasError = false
      let count = 0
      activeQueries.forEach((query) =>
        this.queryHandler.refetch(query, {
          onData: (data) => this.cache.storeQueryData(query, data),
          onComplete: () => {
            if (++count === activeQueries.length) {
              resolve()
            }
          },
          onError: (err) => {
            if (!hasError) {
              hasError = true
              reject(err)
            }
          },
        })
      )
    })
  }

  resetStore() {
    return new Promise<void>((resolve) => {
      this.cache.reset((queriesToRefetch) => {
        if (queriesToRefetch.length === 0) {
          return resolve()
        }

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

  deleteQuery(query: Query<any, any, any> | LocalQuery<any>) {
    return new Promise<void>((resolve) => {
      const actualQuery = query instanceof Query ? getActualQuery(query) : query
      const activeQuery = this.cache.findActiveQuery(actualQuery)
      if (!activeQuery) {
        this.cache.removeInactiveQueries([actualQuery])
        resolve()
      } else if (activeQuery instanceof LocalQuery) {
        // prettier-ignore
        this.cache.storeQueryData(activeQuery, activeQuery.options.initialValue ?? null)
        resolve()
      } else {
        // @ts-ignore
        this.queryHandler.refetch(activeQuery, {
          onData: (data) => this.cache.storeQueryData(activeQuery, data),
          onComplete: resolve,
          onError: resolve,
        })
      }
    })
  }

  //========== Private methods =============

  // prettier-ignore
  private separateInactiveQueries(
    queries: Array<Query<any, any, any> | CompoundQuery<any, any, any>>
  ) {
    const activeQueries: Array<Query<any, any, any> | CompoundQuery<any, any, any>> = []
    const inactiveQueries: Array<Query<any, any, any> | CompoundQuery<any, any, any>> = []
    queries.forEach((query) => {
      const activeQuery = this.cache.findActiveQuery(query)
      if (activeQuery) {
        // @ts-ignore
        activeQueries.push(activeQuery)
      } else {
        inactiveQueries.push(query)
      }
    })
    return [activeQueries, inactiveQueries]
  }
}

export default AdvancedStoreImpl

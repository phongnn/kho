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
    const activeQueries = this.cache.purgeInactiveQueries(
      queries.map((q) => getActualQuery(q))
    )
    return this.doRefetchQueries(activeQueries)
  }

  resetStore() {
    return new Promise<void>((resolve, reject) => {
      this.cache.reset((activeQueries) => {
        const queriesToFetch = activeQueries.map((q) =>
          q instanceof CompoundQuery ? q.original : q
        )
        this.doRefetchQueries(queriesToFetch).then(resolve).catch(reject)
      })
    })
  }

  //========== Private methods =============

  private doRefetchQueries(
    queries: Array<Query<any, any, any> | CompoundQuery<any, any, any>>
  ) {
    return new Promise<void>((resolve, reject) => {
      if (queries.length === 0) {
        return resolve()
      }

      let hasError = false
      let count = 0
      queries.forEach((query) =>
        this.queryHandler.refetch(query, {
          onData: (data) => this.cache.storeQueryData(query, data),
          onComplete: () => {
            if (++count === queries.length) {
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
}

export default AdvancedStoreImpl
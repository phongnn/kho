import {
  Query,
  QueryOptions,
  LocalQuery,
  CompoundQuery,
  Mutation,
  MutationOptions,
  LocalMutation,
  StoreOptions,
} from "../../common"
import { getActualQuery } from "../../common/helpers"
import { AdvancedStore } from "../AdvancedStore"
import CacheController from "./CacheController"
import QueryHandler from "./QueryHandler"
import MutationHandler from "./MutationHandler"

class AdvancedStoreImpl implements AdvancedStore {
  readonly options: Omit<StoreOptions, "preloadedState">
  private cache: CacheController
  private queryHandler: QueryHandler
  private mutationHandler: MutationHandler

  constructor(options: StoreOptions) {
    const { preloadedState, ...rest } = options
    this.options = rest
    this.cache = new CacheController(preloadedState)
    this.queryHandler = new QueryHandler(this.cache)
    this.mutationHandler = new MutationHandler(this, this.cache)
  }

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
    // prettier-ignore
    const { unregister, ...rest } = this.queryHandler.registerQuery(query, callbacks)
    let unregistered = false
    const registrationResult = {
      unregister: () => {
        unregistered = true
        unregister()
      },
      ...rest,
    }

    // refetch query when expired
    const { expiryMs = this.options.queryExpiryMs, fetchPolicy } = query.options
    // network-only queries don't have expired data as they always get latest from backend
    if (fetchPolicy !== "network-only" && expiryMs > 0) {
      const refetchWhenExpired = () => {
        this.refetchQueries([query])
        if (!unregistered) {
          setTimeout(refetchWhenExpired, expiryMs)
        }
      }
      setTimeout(refetchWhenExpired, expiryMs)
    }

    return registrationResult
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
    this.mutationHandler.process(mutation, callbacks)
  }

  processLocalMutation<Input>(
    mutation: LocalMutation<Input>,
    callbacks: {
      onComplete?: () => void
      onError?: (err: Error) => void
    } = {}
  ) {
    this.mutationHandler.processLocal(mutation, callbacks)
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
      "arguments" | "context" | "optimisticResponse" | "syncMode"
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

  mutateLocal<Input>(
    mutation: LocalMutation<Input>,
    options: { input?: Input; syncMode?: boolean } = {}
  ) {
    const actualMutation = options ? mutation.withOptions(options) : mutation
    return new Promise<void>((resolve, reject) => {
      this.processLocalMutation(actualMutation, {
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

  refetchActiveQueries() {
    return new Promise<void>((resolve, reject) => {
      const queries = this.cache.getActiveNonLocalQueries()
      this.doRefetchQueries(queries).then(resolve).catch(reject)
    })
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

  getState() {
    return this.cache.getState()
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

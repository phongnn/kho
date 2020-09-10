import { BaseQuery } from "../../query/BaseQuery"
import CacheContainer, { CacheKey } from "../../cache/CacheContainer"
import { Mutation } from "../../query/Mutation"
import CompoundQuery from "../../fetcher/CompoundQuery"

interface ActiveQueryInfo {
  readonly onData: (data: any) => void
  cacheKey?: CacheKey
}

class CacheController {
  private activeQueries = new Map<BaseQuery, ActiveQueryInfo>()
  private cache = new CacheContainer()

  /** returns true if query's data is already in cache */
  subscribe(query: BaseQuery, onData: (data: any) => void) {
    const cacheKey = this.cache.findCacheKey(query)
    if (cacheKey) {
      this.activeQueries.set(query, { onData, cacheKey })
      onData(this.cache.get(cacheKey)) // callback immediately
      return true
    } else {
      this.activeQueries.set(query, { onData })
      return false
    }
  }

  unsubscribe(query: BaseQuery) {
    this.activeQueries.delete(query)
  }

  storeQueryData(query: BaseQuery, data: any) {
    const cacheKey = this.cache.saveQueryData(query, data)

    // set cacheKey for those active queries that are pending for data fetching
    for (const [q, qInfo] of this.activeQueries) {
      if (!qInfo.cacheKey && cacheKey.matches(q)) {
        qInfo.cacheKey = cacheKey
      }
    }

    this.notifyActiveQueries()
  }

  mergeQueryData<TResult, TArguments, TContext>(
    query: CompoundQuery<TResult, TArguments, TContext>,
    newData: any,
    mergeFn: (existingData: any, newData: any) => any
  ) {
    const cacheKey = this.activeQueries.get(query)?.cacheKey
    if (!cacheKey) {
      throw new Error(`[FNC] Unable to find cache key to merge data.`)
    }

    const { shape } = query.original.options
    this.cache.saveAdditionalQueryData(cacheKey, newData, shape, mergeFn)
    this.notifyActiveQueries()
  }

  storeMutationResult<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    data: any,
    optimistic: boolean = false
  ) {
    const { shape, update: updateFn } = mutation.options
    this.cache.saveMutationResult(data, shape, updateFn, optimistic)
    this.notifyActiveQueries()
  }

  /** resets cache then refetches active queries */
  reset(cb: (activeQueries: BaseQuery[]) => void) {
    this.cache.clear()

    const queries: BaseQuery[] = []
    for (const [q, qInfo] of this.activeQueries) {
      qInfo.cacheKey = undefined
      queries.push(q)
    }

    cb(queries)
  }

  clear() {
    this.cache.clear()
    this.activeQueries.clear()
  }

  // notify active queries of possible state change
  private notifyActiveQueries() {
    for (const [q, qInfo] of this.activeQueries) {
      if (qInfo.cacheKey) {
        qInfo.onData(this.cache.get(qInfo.cacheKey))
      }
    }
  }
}

export default CacheController

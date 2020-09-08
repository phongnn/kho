import { BaseQuery } from "../../query/BaseQuery"
import CacheContainer, { CacheKey } from "../../cache/CacheContainer"
import { Mutation } from "../../query/Mutation"

interface ActiveQueryInfo {
  readonly onData: (data: any) => void
  cacheKey?: CacheKey
  latestData?: any // used when we need to merge query's data (fetchMore)
}

class CacheController {
  private activeQueries = new Map<BaseQuery, ActiveQueryInfo>()
  private cache = new CacheContainer()

  /** returns true if query's data is already in cache */
  subscribe(query: BaseQuery, onData: (data: any) => void) {
    const cacheKey = this.cache.findCacheKey(query)
    if (cacheKey) {
      const latestData = this.cache.get(cacheKey)
      this.activeQueries.set(query, { onData, cacheKey, latestData })
      onData(latestData) // callback immediately
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

  storeMutationResult<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    data: any
  ) {
    const normalizedData = this.cache.saveMutationResult(mutation, data)

    const updateFn = mutation.options.update
    if (updateFn) {
      updateFn(this.cache, { data: normalizedData })
    }

    this.notifyActiveQueries()
  }

  retrieveActiveQueryData(query: BaseQuery) {
    return this.activeQueries.get(query)?.latestData
  }

  // notify active queries of possible state change
  private notifyActiveQueries() {
    for (const [q, qInfo] of this.activeQueries) {
      if (!qInfo.cacheKey) {
        continue
      }

      const latestData = this.cache.get(qInfo.cacheKey)
      qInfo.latestData = latestData
      qInfo.onData(latestData)
    }
  }
}

export default CacheController

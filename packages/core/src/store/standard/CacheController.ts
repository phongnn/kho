import { BaseQuery } from "../../query/BaseQuery"
import CacheContainer, { CacheKey } from "../../cache/CacheContainer"

interface ActiveQueryInfo {
  readonly onData: (data: any) => void
  cacheKey?: CacheKey
  latestData?: any
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
    const cacheKey = this.cache.save(query, data)

    for (const [q, qInfo] of this.activeQueries) {
      // set cacheKey for those active queries that are pending for data fetching
      if (!qInfo.cacheKey && cacheKey.matches(q)) {
        qInfo.cacheKey = cacheKey
      }

      // notify active queries of possible state change
      if (qInfo.cacheKey) {
        const latestData = this.cache.get(qInfo.cacheKey)
        qInfo.latestData = latestData
        qInfo.onData(latestData)
      }
    }
  }

  retrieveQueryData(query: BaseQuery) {
    return this.activeQueries.get(query)?.latestData
  }
}

export default CacheController

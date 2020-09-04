import { BaseQuery } from "../Query"
import CacheContainer, { CacheKey } from "./cache/CacheContainer"

class ActiveQuery {
  constructor(
    readonly query: BaseQuery,
    readonly onData: (data: any) => void,
    readonly cacheKey?: CacheKey
  ) {}
}

class CacheController {
  private activeQueries: ActiveQuery[] = []
  private cache = new CacheContainer()

  /** returns true if query's data is already in cache */
  subscribe(query: BaseQuery, onData: (data: any) => void) {
    const cacheKey = this.cache.findCacheKey(query)
    if (cacheKey) {
      this.activeQueries.push(new ActiveQuery(query, onData, cacheKey))
      // callback immediately
      onData(this.cache.get(cacheKey))
      return true
    } else {
      this.activeQueries.push(new ActiveQuery(query, onData))
      return false
    }
  }

  unsubscribe(query: BaseQuery) {
    this.activeQueries = this.activeQueries.filter((aq) => aq.query !== query)
  }

  storeQueryData(query: BaseQuery, data: any) {
    const cacheKey = this.cache.save(query, data)

    // set cacheKey for those active queries that are pending for data fetching
    this.activeQueries = this.activeQueries.map((aq) =>
      !!aq.cacheKey || !cacheKey.matches(aq.query)
        ? aq
        : new ActiveQuery(aq.query, aq.onData, cacheKey)
    )

    // notify active queries of possible state change
    this.activeQueries.forEach(
      (aq) => aq.cacheKey && aq.onData(this.cache.get(aq.cacheKey))
    )
  }

  retrieveQueryData(query: BaseQuery) {
    const cacheKey = this.cache.findCacheKey(query)
    return !cacheKey ? null : this.cache.get(cacheKey)
  }
}

export default CacheController

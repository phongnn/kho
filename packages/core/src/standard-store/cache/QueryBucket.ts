import { BaseQuery, QueryKey } from "../../Query"

// Equivalent query keys will share the same cache key
// (this happens when the same query is used in multiple components concurrently).
// Cache keys help us avoid deep comparison of query key against cached query keys
// every time we need to notify active queries of possible state change.
// The introduction of cache keys is a trade-off for performance.
export class CacheKey {
  private queryKey: QueryKey

  constructor(query: BaseQuery) {
    this.queryKey = query.key
  }

  matches(query: BaseQuery) {
    return this.queryKey.matches(query.key)
  }
}

class QueryBucket {
  private queryData = new Map<CacheKey, any>()

  findCacheKey(query: BaseQuery) {
    for (const key of this.queryData.keys()) {
      if (key.matches(query)) {
        return key
      }
    }
    return null
  }

  get = (cacheKey: CacheKey) => this.queryData.get(cacheKey)

  set(query: BaseQuery, data: any) {
    const cacheKey = this.findCacheKey(query) || new CacheKey(query)
    this.queryData.set(cacheKey, data)
    return cacheKey
  }
}

export default QueryBucket

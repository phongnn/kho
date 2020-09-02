import { BaseQuery, QueryKey } from "../../Query"
import Selector from "./Selector"
import DataNormalizer from "./DataNormalizer"

// Equivalent query keys will share the same cache key
// (a query can be used many times by rendering the same component,
//  it can also be used by multiple components).
// Cache keys help us avoid deep comparison of query key against cached query keys
// every time we need to notify active queries of possible state change.
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
  private queryData = new Map<CacheKey, [any, Selector | null]>()

  findCacheKey(query: BaseQuery) {
    for (const key of this.queryData.keys()) {
      if (key.matches(query)) {
        return key
      }
    }
    return null
  }

  get(cacheKey: CacheKey) {
    return this.queryData.get(cacheKey)
  }

  set(cacheKey: CacheKey, value: [any, Selector | null]) {
    this.queryData.set(cacheKey, value)
  }
}

export default QueryBucket

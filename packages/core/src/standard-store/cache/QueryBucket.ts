import { BaseQuery, QueryKey } from "../../Query"

// Equivalent query keys will share the same cache key
// (a query can be used many times by rendering the same component,
//  it can also be used by multiple components).
// Cache keys help us avoid deep comparison of query key against cached query keys
// every time we need to notify active queries of possible state change.
export class CacheKey {
  private queryKey: QueryKey

  constructor(query: BaseQuery<any>) {
    this.queryKey = query.key
  }

  matches(query: BaseQuery<any>) {
    return this.queryKey.matches(query.key)
  }
}

class QueryBucket {
  // TODO: entry values are selectors, NOT data
  private queryData = new Map<CacheKey, any>()

  findCacheKey(query: BaseQuery<any>) {
    for (const key of this.queryData.keys()) {
      if (key.matches(query)) {
        return key
      }
    }
    return null
  }

  // TODO: use the selector to collect relevant data from the ObjectBucket
  get = (cacheKey: CacheKey) => this.queryData.get(cacheKey)

  set(query: BaseQuery<any>, data: any) {
    const cacheKey = this.findCacheKey(query) || new CacheKey(query)

    // TODO: create a selector and save into map
    this.queryData.set(cacheKey, data)
    return cacheKey
  }
}

export default QueryBucket

import { Query } from "../../Query"
import { deepEqual } from "../../helpers"

export class CacheKey {
  private key: any
  constructor(query: Query<any, any>) {
    this.key = query.key
  }

  matches(query: Query<any, any>) {
    return deepEqual(query.key, this.key)
  }
}

class QueryBucket {
  private queryData = new Map<CacheKey, any>()

  findCacheKey(query: Query<any, any>) {
    for (const key of this.queryData.keys()) {
      if (key.matches(query)) {
        return key
      }
    }
    return null
  }

  get = (cacheKey: CacheKey) => this.queryData.get(cacheKey)

  set(query: Query<any, any>, data: any) {
    const cacheKey = this.findCacheKey(query) || new CacheKey(query)
    this.queryData.set(cacheKey, data)
    return cacheKey
  }
}

export default QueryBucket

import {
  BaseQuery,
  BaseQueryKey,
  QueryUpdateInfoArgument,
} from "../query/BaseQuery"
import Selector from "../normalization/Selector"
import { Mutation } from "../query/Mutation"

// Equivalent query keys will share the same cache key
// (a query can be used by multiple components or by one component but renderred several times).
// Cache keys help us avoid deep comparison of query key against cached query keys
// every time we need to notify active queries of possible state change.
export class CacheKey {
  private queryKey: BaseQueryKey

  constructor(query: BaseQuery) {
    this.queryKey = query.key
  }

  matches(query: BaseQuery) {
    return this.queryKey.matches(query.key)
  }
}

interface QueryBucketItem {
  query: BaseQuery
  data: any
  selector: Selector | null
}

class QueryBucket {
  private queryData = new Map<CacheKey, QueryBucketItem>()

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

  set(cacheKey: CacheKey, value: QueryBucketItem) {
    this.queryData.set(cacheKey, value)
  }

  delete(cacheKey: CacheKey) {
    this.queryData.delete(cacheKey)
  }

  clear() {
    this.queryData.clear()
  }

  updateRelatedQueries<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    info: QueryUpdateInfoArgument
  ) {
    for (const item of this.queryData.values()) {
      const { mutations = {} } = item.query.options
      const updateFn = mutations[mutation.name]
      if (updateFn) {
        item.data = updateFn(item.data, info)
      }
    }
  }
}

export default QueryBucket

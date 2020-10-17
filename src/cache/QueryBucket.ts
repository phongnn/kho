import { BaseQuery, BaseQueryKey, Mutation } from "../common"
import { Selector } from "../normalization"

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

interface TrackQueryFn {
  (cacheKey: CacheKey, data: any, selector: Selector): void
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

  /** same query but with different arguments */
  findSiblingQueries(baseQuery: BaseQuery) {
    const result: Array<[BaseQuery, CacheKey]> = []
    for (const [cacheKey, { query }] of this.queryData) {
      if (query.isSibling(baseQuery)) {
        result.push([query, cacheKey])
      }
    }
    return result
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

  updateQueriesRelatedToMutation<TResult, TArguments, TContext>(
    mutationName: string,
    info: {
      mutationResult: any
      mutationArgs: any
      optimistic: boolean
    },
    trackQuery: TrackQueryFn
  ) {
    const updatedCacheKeys: CacheKey[] = []
    for (const [cacheKey, item] of this.queryData) {
      const { data: currentData, query, selector } = item
      const { mutations = {}, arguments: queryArgs } = query.options
      const updateFn = mutations[mutationName]
      if (updateFn) {
        item.data = updateFn(currentData, {
          ...info,
          queryArgs,
        })
        updatedCacheKeys.push(cacheKey)

        // inform ChangeTracker to update query's dependencies
        if (selector) {
          trackQuery(cacheKey, item.data, selector)
        }
      }
    }
    return new Set(updatedCacheKeys)
  }

  updateRelatedQueries(
    queryName: string,
    info: {
      queryResult: any
      queryArgs: any
    },
    trackQuery: TrackQueryFn
  ) {
    const updatedCacheKeys: CacheKey[] = []
    for (const [cacheKey, item] of this.queryData) {
      const { data: currentData, query: relatedQuery, selector } = item
      const { relatedQueries = {}, arguments: queryArgs } = relatedQuery.options
      const updateFn = relatedQueries[queryName]
      if (updateFn) {
        item.data = updateFn(currentData, {
          relatedQueryResult: info.queryResult,
          relatedQueryArgs: info.queryArgs,
          queryArgs,
        })
        updatedCacheKeys.push(cacheKey)

        // inform ChangeTracker to update query's dependencies
        if (selector) {
          trackQuery(cacheKey, item.data, selector)
        }
      }
    }
    return new Set(updatedCacheKeys)
  }
}

export default QueryBucket

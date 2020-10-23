import { BaseQuery, Query, Selector as PlainSelector } from "../common"
import { Selector } from "../normalization"

// Equivalent query keys will share the same cache key
// (a query can be used by multiple components or by one component but renderred several times).
// Cache keys help us avoid deep comparison of query key against cached query keys
// every time we need to notify active queries of possible state change.
export class CacheKey {
  constructor(private plainQueryKey: any) {}

  matches(query: BaseQuery) {
    return query.key.matchesPlain(this.plainQueryKey)
  }

  plain() {
    return this.plainQueryKey
  }
}

interface QueryBucketItem {
  query: BaseQuery
  name: string
  arguments: any
  data: any
  selector: Selector | null
}

interface QueryBucketSerializableItem {
  cacheKey: any
  data: any
  selector: PlainSelector | null
  // query:
}

interface TrackQueryFn {
  (cacheKey: CacheKey, data: any, selector: Selector): void
}

class QueryBucket {
  private queryData: Map<CacheKey, QueryBucketItem>

  constructor(preloadedState?: QueryBucketSerializableItem[]) {
    const queryData = new Map<CacheKey, QueryBucketItem>()
    if (preloadedState) {
      preloadedState.forEach(({ cacheKey, data, selector }) => {
        // @ts-ignore
        queryData.set(new CacheKey(cacheKey), {
          data,
          selector: selector ? Selector.from(selector) : null,
        })
      })
    }
    this.queryData = queryData
  }

  getState() {
    const result: QueryBucketSerializableItem[] = []
    this.queryData.forEach(({ data, selector }, cacheKey) => {
      result.push({
        cacheKey: cacheKey.plain(),
        selector: selector ? selector.plain() : null,
        data,
        // query,
      })
    })
    return result
  }

  findCacheKey(query: BaseQuery) {
    for (const key of this.queryData.keys()) {
      if (key.matches(query)) {
        return key
      }
    }
    return null
  }

  findCachedQueryArgs(query: Query<any, any, any>) {
    const result: Array<[CacheKey, any]> = []
    for (const [cacheKey, { name, arguments: args }] of this.queryData) {
      if (query.name === name && query.argumentsMatch(args)) {
        result.push([cacheKey, args])
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

  updateQueriesRelatedToMutation(
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

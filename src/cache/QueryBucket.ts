// prettier-ignore
import { BaseQuery, LocalMutation, Mutation, NormalizedObjectRef, Query, Selector as PlainSelector } from "../common"
import { Selector } from "../normalization"
import { deserializeData, serializeData } from "./DataSerializer"

// Equivalent query keys will share the same cache key
// (a query can be used by multiple components or by one component but renderred several times).
// Cache keys help us avoid deep comparison of query key against cached query keys
// every time we need to notify active queries of possible state change.
export class CacheKey {
  constructor(private plainQueryKey: any) {}

  matches(query: BaseQuery) {
    return query.key.matchesPlain(this.plainQueryKey)
  }

  plain = () => this.plainQueryKey
}

interface QueryBucketItem {
  name: string
  arguments: any
  data: any
  selector: Selector | null
}

interface SerializableBucketItem {
  cacheKey: any
  name: string
  arguments: any
  data: any
  selector: PlainSelector | null
}

interface TrackQueryFn {
  (cacheKey: CacheKey, data: any, selector: Selector): void
}

class QueryBucket {
  private queryData: Map<CacheKey, QueryBucketItem>

  constructor(
    preloadedState?: SerializableBucketItem[],
    getObjectRef?: (typeName: string, plainKey: any) => NormalizedObjectRef,
    trackQuery?: (cacheKey: CacheKey, data: any, selector: Selector) => void
  ) {
    const queryData = new Map<CacheKey, QueryBucketItem>()
    if (preloadedState) {
      preloadedState.forEach(({ cacheKey, selector, data, ...rest }) => {
        const restoredCacheKey = new CacheKey(cacheKey)
        const restoredData =
          data && selector ? deserializeData(data, getObjectRef!) : data
        const restoredSelector = selector ? Selector.from(selector) : null
        queryData.set(restoredCacheKey, {
          ...rest,
          data: restoredData,
          selector: restoredSelector,
        })

        if (data && selector) {
          trackQuery!(restoredCacheKey, restoredData, restoredSelector!)
        }
      })
    }
    this.queryData = queryData
  }

  getState() {
    const result: SerializableBucketItem[] = []
    this.queryData.forEach(({ selector, data, ...rest }, cacheKey) => {
      result.push({
        cacheKey: cacheKey.plain(),
        ...rest,
        data: data && selector ? serializeData(data) : data,
        selector: selector ? selector.plain() : null,
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

  // prettier-ignore
  updateQueriesRelatedToMutation(
    mutation: Mutation<any, any, any> | LocalMutation<any>,
    info: any,
    trackQuery: TrackQueryFn
  ) {
    const { queryUpdates } = mutation.options
    if (!queryUpdates || Object.getOwnPropertyNames(queryUpdates).length === 0) {
      return new Set<CacheKey>()
    }

    const updatedCacheKeys: CacheKey[] = []
    for (const [cacheKey, item] of this.queryData) {
      const { data: currentData, selector, arguments: queryArgs, name: queryName } = item
      const updateFn = queryUpdates[queryName]
      if (updateFn) {
        item.data = updateFn(currentData, { ...info, queryArgs })
        updatedCacheKeys.push(cacheKey)
        // inform ChangeTracker to update query's dependencies
        if (selector) {
          trackQuery(cacheKey, item.data, selector)
        }
      }
    }
    return new Set(updatedCacheKeys)
  }

  // prettier-ignore
  updateRelatedQueries(query: BaseQuery, queryResult: any, trackQuery: TrackQueryFn) {
    const { queryUpdates, arguments: relatedQueryArgs } = query.options
    if (!queryUpdates || Object.getOwnPropertyNames(queryUpdates).length === 0) {
      return new Set<CacheKey>()
    }

    const updatedCacheKeys: CacheKey[] = []
    for (const [cacheKey, item] of this.queryData) {
      const { data: currentData, selector, name: queryName, arguments: queryArgs } = item
      const updateFn = queryUpdates[queryName]
      if (updateFn) {
        item.data = updateFn(currentData, {
          relatedQueryResult: queryResult,
          relatedQueryArgs,
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

import { BaseQuery, BaseQueryKey, QueryUpdateFn, Mutation } from "../common"
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

class QueryBucket {
  private queryData = new Map<CacheKey, QueryBucketItem>()
  private updateFunctions = new Map<string, Map<CacheKey, QueryUpdateFn>>()

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
    const isNewQuery = !this.queryData.get(cacheKey)
    this.queryData.set(cacheKey, value)

    if (isNewQuery) {
      const { mutations = {} } = value.query.options
      Object.entries(mutations).forEach(([mutationName, updateFn]) => {
        const existingFunctions = this.updateFunctions.get(mutationName)
        if (existingFunctions) {
          existingFunctions.set(cacheKey, updateFn)
        } else {
          this.updateFunctions.set(
            mutationName,
            new Map<CacheKey, QueryUpdateFn>([[cacheKey, updateFn]])
          )
        }
      })
    }
  }

  delete(cacheKey: CacheKey) {
    this.queryData.delete(cacheKey)

    for (const fnList of this.updateFunctions.values()) {
      fnList.delete(cacheKey)
    }
  }

  clear() {
    this.queryData.clear()
    this.updateFunctions.clear()
  }

  updateRelatedQueries<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    info: {
      mutationResult: any
      mutationArgs: any
      optimistic: boolean
    }
  ) {
    const updateFunctions = this.updateFunctions.get(mutation.name)
    if (updateFunctions) {
      for (const [cacheKey, updateFn] of updateFunctions) {
        const item = this.queryData.get(cacheKey)!
        const { data: currentData, query } = item
        item.data = updateFn(currentData, {
          ...info,
          queryArgs: query.options.arguments,
        })
      }
    }
    // for (const item of this.queryData.values()) {
    //   const { mutations = {} } = item.query.options
    //   const updateFn = mutations[mutation.name]
    //   if (updateFn) {
    //     item.data = updateFn(item.data, info)
    //   }
    // }
  }
}

export default QueryBucket

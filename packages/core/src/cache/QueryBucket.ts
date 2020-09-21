import {
  BaseQuery,
  BaseQueryKey,
  QueryUpdateFn,
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
  private updateFunctions = new Map<string, Map<CacheKey, QueryUpdateFn>>()

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
    info: QueryUpdateInfoArgument
  ) {
    const updateFunctions = this.updateFunctions.get(mutation.name)
    if (updateFunctions) {
      for (const [cacheKey, updateFn] of updateFunctions) {
        const item = this.queryData.get(cacheKey)!
        item.data = updateFn(item.data, info)
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

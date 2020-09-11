import { BaseQuery } from "../query/BaseQuery"
import { LocalQuery } from "../query/LocalQuery"
import { FNCCache, MutationUpdateFn } from "../query/Mutation"
// prettier-ignore
import { NormalizedType, NormalizedShape } from "../normalization/NormalizedType"
import DataNormalizer from "../normalization/DataNormalizer"
import DataDenormalizer from "../normalization/DataDenormalizer"
import ObjectBucket from "./ObjectBucket"
import QueryBucket, { CacheKey } from "./QueryBucket"
import { extractPlainKey } from "../helpers"

export { CacheKey } from "./QueryBucket"

class CacheContainer {
  private queryBucket = new QueryBucket()
  private objectBucket = new ObjectBucket()

  findCacheKey(query: BaseQuery) {
    return this.queryBucket.findCacheKey(query)
  }

  get(cacheKey: CacheKey) {
    const cacheEntry = this.queryBucket.get(cacheKey)
    if (!cacheEntry) {
      return null
    }

    const [data, selector] = cacheEntry
    if (!selector) {
      return data
    }

    const denormalizer = new DataDenormalizer((type, key) =>
      this.objectBucket.get(type, key)
    )

    return denormalizer.denormalize(data, selector)
  }

  saveQueryData(query: BaseQuery, data: any) {
    const existingCacheKey = this.findCacheKey(query)
    const cacheKey = existingCacheKey || new CacheKey(query)
    const { shape } = query.options
    if (!shape) {
      this.queryBucket.set(cacheKey, [data, null]) // data not normalized -> no selector
    } else {
      const normalizer = this.createNormalizer()
      const { result, objects, selector } = normalizer.normalize(data, shape)

      this.queryBucket.set(cacheKey, [result, selector])
      this.objectBucket.add(objects)
    }
    return existingCacheKey ? null : cacheKey // returns new cache key only
  }

  removeQueryData(q: BaseQuery): void {
    const cacheKey = this.findCacheKey(q)
    if (cacheKey) {
      this.queryBucket.delete(cacheKey)
    }
  }

  saveAdditionalQueryData(
    cacheKey: CacheKey,
    newData: any,
    shape: NormalizedShape | undefined,
    mergeFn: (existingData: any, newData: any) => any
  ) {
    const [existingData, existingSelector] = this.queryBucket.get(cacheKey)!
    if (!shape) {
      const data = mergeFn(existingData, newData)
      this.queryBucket.set(cacheKey, [data, existingSelector])
    } else {
      const normalizer = this.createNormalizer()
      // prettier-ignore
      const { result, objects, selector: newSelector } = normalizer.normalize(newData, shape)

      this.objectBucket.add(objects)

      const data = mergeFn(existingData, result)
      existingSelector!.merge(newSelector)
      this.queryBucket.set(cacheKey, [data, existingSelector])
    }
  }

  saveMutationResult(
    data: any,
    shape: NormalizedShape | undefined,
    updateFn: MutationUpdateFn | undefined,
    optimistic: boolean,
    callback: (newCacheKeys: CacheKey[]) => void
  ) {
    let normalizedData: any = null
    if (shape) {
      const normalizer = this.createNormalizer()
      const { result, objects } = normalizer.normalize(data, shape)

      this.objectBucket.add(objects)
      normalizedData = result
    }

    if (updateFn) {
      const cacheProxy = new FNCCacheProxy(this) // to keep track of cache keys added when executing update()
      updateFn(cacheProxy, { data: normalizedData || data, optimistic })
      if (cacheProxy.newCacheKeys.length > 0) {
        callback(cacheProxy.newCacheKeys) // to update cache key of queries pending for data
      }
    }
  }

  clear() {
    this.objectBucket.clear()
    this.queryBucket.clear()
  }

  //============= FNCCache methods (called only from mutation's update()) =========

  // Note: unlike saveQueryData(), this function expects data already in normalized format.
  updateQueryResult(query: BaseQuery, fn: (existingData: any) => any) {
    const cacheKey = this.findCacheKey(query)
    if (!cacheKey) {
      const newCacheKey = new CacheKey(query)
      // prettier-ignore
      const data = fn(query instanceof LocalQuery ? query.options.initialValue : null)
      this.queryBucket.set(newCacheKey, [data, null])
      return newCacheKey
    } else {
      const [existingData, selector] = this.queryBucket.get(cacheKey)!
      const updatedData = fn(existingData)
      this.queryBucket.set(cacheKey, [updatedData, selector])
    }
  }

  evictObject(type: NormalizedType, key: any) {
    const objectKey = this.objectBucket.findObjectKey(
      type,
      extractPlainKey(key, type)
    )

    if (objectKey) {
      this.objectBucket.delete(type, objectKey)
    }
  }

  //============= private methods =========
  private createNormalizer() {
    return new DataNormalizer((type, plainKey) =>
      this.objectBucket.findObjectKey(type, plainKey)
    )
  }
}

/** Used only for storing cache keys newly added when handling Mutation's update() function */
class FNCCacheProxy implements FNCCache {
  constructor(
    private cache: CacheContainer,
    readonly newCacheKeys: CacheKey[] = []
  ) {}

  updateQueryResult(query: BaseQuery, fn: (existingData: any) => any) {
    const newCacheKey = this.cache.updateQueryResult(query, fn)
    if (newCacheKey) {
      this.newCacheKeys.push(newCacheKey)
    }
  }

  evictObject(type: NormalizedType, key: any) {
    this.cache.evictObject(type, key)
  }
}

export default CacheContainer

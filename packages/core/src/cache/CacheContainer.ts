import { BaseQuery } from "../query/BaseQuery"
import QueryBucket, { CacheKey } from "./QueryBucket"
import { Mutation, FNCCache } from "../query/Mutation"
import ObjectBucket from "./ObjectBucket"
import DataNormalizer from "../normalization/DataNormalizer"
import DataDenormalizer from "../normalization/DataDenormalizer"
import { NormalizedType } from "../normalization/NormalizedType"
import { extractPlainKey } from "../helpers"

export { CacheKey } from "./QueryBucket"

class CacheContainer implements FNCCache {
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
    const cacheKey = this.findCacheKey(query) || new CacheKey(query)

    const { shape } = query.options
    if (!shape) {
      this.queryBucket.set(cacheKey, [data, null]) // data not normalized -> no selector
    } else {
      const normalizer = new DataNormalizer((type, plainKey) =>
        this.objectBucket.findObjectKey(type, plainKey)
      )
      const { result, objects, selector } = normalizer.normalize(data, shape)

      this.queryBucket.set(cacheKey, [result, selector])
      this.objectBucket.add(objects)
    }

    return cacheKey
  }

  saveMutationResult<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    data: any
  ) {
    const { shape } = mutation.options
    if (!shape) {
      return data
    }

    const normalizer = new DataNormalizer((type, plainKey) =>
      this.objectBucket.findObjectKey(type, plainKey)
    )
    const { result, objects } = normalizer.normalize(data, shape)

    this.objectBucket.add(objects)
    return result
  }

  /** implements FNCCache methods which can only be called from within mutation's update() function */
  updateQueryResult(query: BaseQuery, fn: (existingData: any) => any) {
    const cacheKey = this.findCacheKey(query)
    if (!cacheKey) {
      this.queryBucket.set(new CacheKey(query), fn(undefined))
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
}

export default CacheContainer

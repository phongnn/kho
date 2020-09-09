import { BaseQuery } from "../query/BaseQuery"
import QueryBucket, { CacheKey } from "./QueryBucket"
import { FNCCache, MutationUpdateFn } from "../query/Mutation"
import ObjectBucket from "./ObjectBucket"
import {
  NormalizedType,
  NormalizedShape,
} from "../normalization/NormalizedType"
import DataNormalizer from "../normalization/DataNormalizer"
import DataDenormalizer from "../normalization/DataDenormalizer"
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
      const normalizer = this.createNormalizer()
      const { result, objects, selector } = normalizer.normalize(data, shape)

      this.queryBucket.set(cacheKey, [result, selector])
      this.objectBucket.add(objects)
    }
    return cacheKey
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
    optimistic: boolean = false
  ) {
    let normalizedData: any = null
    if (shape) {
      const normalizer = this.createNormalizer()
      const { result, objects } = normalizer.normalize(data, shape)

      this.objectBucket.add(objects)
      normalizedData = result
    }

    if (updateFn) {
      updateFn(this, { data: normalizedData || data, optimistic })
    }
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

  //============= private methods =========
  private createNormalizer() {
    return new DataNormalizer((type, plainKey) =>
      this.objectBucket.findObjectKey(type, plainKey)
    )
  }
}

export default CacheContainer

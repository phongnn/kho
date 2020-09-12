import { BaseQuery } from "../query/BaseQuery"
import { LocalQuery } from "../query/LocalQuery"
import { FNCCache, MutationUpdateFn } from "../query/Mutation"
// prettier-ignore
import { NormalizedType, NormalizedShape } from "../normalization/NormalizedType"
import DataNormalizer from "../normalization/DataNormalizer"
import DataDenormalizer from "../normalization/DataDenormalizer"
import ObjectBucket from "./ObjectBucket"
import QueryBucket, { CacheKey } from "./QueryBucket"
import { extractPlainKey, getActualQuery } from "../helpers"
import { Query } from "../query/Query"
import {
  NormalizedObjectKey,
  NormalizedObjectRef,
} from "../normalization/NormalizedObject"

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
    const existingCacheKey = this.findCacheKey(query)
    const cacheKey = existingCacheKey || new CacheKey(query)
    const { shape } = query.options
    if (!shape) {
      this.queryBucket.set(cacheKey, [data, null]) // data not normalized -> no selector
    } else {
      const normalizer = this.createNormalizer()
      const { result, objects, selector } = normalizer.normalize(data, shape)

      this.queryBucket.set(cacheKey, [result, selector])
      this.objectBucket.addObjects(objects)
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

      this.objectBucket.addObjects(objects)

      const data = mergeFn(existingData, result)
      existingSelector!.merge(newSelector)
      this.queryBucket.set(cacheKey, [data, existingSelector])
    }
  }

  saveMutationResult(
    data: any,
    shape: NormalizedShape | undefined,
    updateFn: MutationUpdateFn | undefined,
    optimistic: boolean
  ) {
    let normalizedData: any = null
    if (shape) {
      const normalizer = this.createNormalizer()
      const { result, objects } = normalizer.normalize(data, shape)

      this.objectBucket.addObjects(objects)
      normalizedData = result
    }

    if (updateFn) {
      updateFn(this, { data: normalizedData || data, optimistic })
    }
  }

  clear() {
    this.objectBucket.clear()
    this.queryBucket.clear()
  }

  //============= FNCCache methods (called only from mutation's update()) =========

  readQuery(query: BaseQuery) {
    const actualQuery = query instanceof Query ? getActualQuery(query) : query
    const cacheKey = this.findCacheKey(actualQuery)
    return cacheKey ? this.queryBucket.get(cacheKey)![0] : null
  }

  // Note: unlike saveQueryData(), this function expects data already in normalized format.
  updateQuery(query: BaseQuery, data: any) {
    const actualQuery = query instanceof Query ? getActualQuery(query) : query
    const cacheKey = this.findCacheKey(actualQuery)
    if (cacheKey) {
      const [_, selector] = this.queryBucket.get(cacheKey)!
      this.queryBucket.set(cacheKey, [data, selector])
    } else if (query instanceof LocalQuery) {
      this.queryBucket.set(new CacheKey(query), [data, null])
    } else {
      // prettier-ignore
      throw Error(`[FNC] updateQuery() requires data to be already in cache.`)
    }
  }

  addObject(type: NormalizedType, data: any) {
    const plainKey = extractPlainKey(data, type)
    const key =
      this.objectBucket.findObjectKey(type, plainKey) ||
      new NormalizedObjectKey(plainKey)

    this.objectBucket.set(type, key, data)

    return new NormalizedObjectRef(type, key)
  }

  findObjectRef(type: NormalizedType, key: any) {
    const plainKey = extractPlainKey(key, type)
    const objectKey = this.objectBucket.findObjectKey(type, plainKey)
    return objectKey ? new NormalizedObjectRef(type, objectKey) : null
  }

  readObject(ref: NormalizedObjectRef) {
    return this.objectBucket.get(ref.type, ref.key)
  }

  updateObject(ref: NormalizedObjectRef, data: any) {
    this.objectBucket.set(ref.type, ref.key, data)
  }

  deleteObject(ref: NormalizedObjectRef) {
    this.objectBucket.delete(ref.type, ref.key)
  }

  //============= private methods =========
  private createNormalizer() {
    return new DataNormalizer((type, plainKey) =>
      this.objectBucket.findObjectKey(type, plainKey)
    )
  }
}

export default CacheContainer

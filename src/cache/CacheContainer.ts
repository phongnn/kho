import {
  Query,
  BaseQuery,
  CacheFacade,
  Mutation,
  NormalizedType,
  NormalizedShape,
  NormalizedObjectKey,
  NormalizedObjectRef,
} from "../common"
import { extractPlainKey, getActualQuery } from "../common/helpers"
import { DataNormalizer, DataDenormalizer } from "../normalization"
import ChangeTracker from "./ChangeTracker"
import ObjectBucket from "./ObjectBucket"
import QueryBucket, { CacheKey } from "./QueryBucket"

class CacheContainer implements CacheFacade {
  readonly changeTracker = new ChangeTracker()
  private queryBucket = new QueryBucket()
  private objectBucket = new ObjectBucket()

  findCacheKey(query: BaseQuery) {
    return this.queryBucket.findCacheKey(query)
  }

  findSiblingQueries(query: Query<any, any, any>) {
    return this.queryBucket.findSiblingQueries(query)
  }

  get(cacheKey: CacheKey) {
    const cacheEntry = this.queryBucket.get(cacheKey)
    if (!cacheEntry) {
      return null
    }

    const { data, selector, query } = cacheEntry
    if (!selector) {
      return data
    }

    const denormalizer = new DataDenormalizer((type, key) =>
      this.objectBucket.get(type, key)
    )

    return denormalizer.denormalize(data, selector, query.options.transform)
  }

  saveQueryData(query: BaseQuery, data: any) {
    const existingCacheKey = this.findCacheKey(query)
    const cacheKey = existingCacheKey || new CacheKey(query)
    let affectedCacheKeys: Set<CacheKey>

    const { shape } = query.options
    if (!shape) {
      // data not normalized
      this.queryBucket.set(cacheKey, { query, data, selector: null })
      affectedCacheKeys = new Set([cacheKey])
    } else {
      const normalizer = this.createNormalizer()
      const { result, objects, selector } = normalizer.normalize(data, shape)

      this.queryBucket.set(cacheKey, { query, data: result, selector })
      this.objectBucket.addObjects(objects)
      affectedCacheKeys = this.changeTracker.saveQueryData(cacheKey, objects)
    }

    return {
      newCacheKey: existingCacheKey ? null : cacheKey,
      affectedCacheKeys,
    }
  }

  saveMoreQueryData(
    cacheKey: CacheKey,
    newData: any,
    shape: NormalizedShape | undefined,
    mergeFn: (existingData: any, newData: any) => any
  ) {
    const existingItem = this.queryBucket.get(cacheKey)!
    const { data: existingData, selector: existingSelector } = existingItem
    if (!shape) {
      existingItem.data = mergeFn(existingData, newData)
      return new Set([cacheKey])
    } else {
      const normalizer = this.createNormalizer()
      // prettier-ignore
      const { result, objects, selector: newSelector } = normalizer.normalize(newData, shape)
      this.objectBucket.addObjects(objects)
      if (newSelector) {
        existingSelector!.merge(newSelector)
      }
      existingItem.data = mergeFn(existingData, result)
      return this.changeTracker.saveMoreQueryData(cacheKey, objects) // affected cache keys
    }
  }

  saveMutationResult(data: any, shape: NormalizedShape) {
    const normalizer = this.createNormalizer()
    const { result, objects } = normalizer.normalize(data, shape)
    this.objectBucket.addObjects(objects)
    const affectedCacheKeys = this.changeTracker.findAffectedCacheKeys(objects)
    return {
      normalizedData: result,
      affectedCacheKeys,
    }
  }

  updateRelatedQueries<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    info: {
      mutationResult: any
      mutationArgs: any
      optimistic: boolean
    }
  ) {
    // return set of updated cache keys
    return this.queryBucket.updateRelatedQueries(mutation, info)
  }

  removeQueries(keys: CacheKey[]) {
    keys.forEach((k) => this.queryBucket.delete(k))
  }

  clear() {
    this.objectBucket.clear()
    this.queryBucket.clear()
  }

  //============= CacheFacade methods (called only from mutation's beforeQueryUpdates()) =========

  readQuery(query: BaseQuery) {
    const actualQuery = query instanceof Query ? getActualQuery(query) : query
    const cacheKey = this.findCacheKey(actualQuery)
    return cacheKey ? this.queryBucket.get(cacheKey)!.data : null
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

// prettier-ignore
import { Query, BaseQuery, NormalizedType, NormalizedShape, NormalizedObjectKey, NormalizedObjectRef, LocalMutation, Mutation } from "../common"
import { extractPlainKey } from "../common/helpers"
import { DataNormalizer, DataDenormalizer, Selector } from "../normalization"
import ChangeTracker from "./ChangeTracker"
import ObjectBucket from "./ObjectBucket"
import QueryBucket, { CacheKey } from "./QueryBucket"

class CacheContainer {
  readonly changeTracker: ChangeTracker
  private queryBucket: QueryBucket
  private objectBucket: ObjectBucket

  constructor(preloadedState?: any) {
    this.changeTracker = new ChangeTracker(this)
    if (!preloadedState) {
      this.objectBucket = new ObjectBucket()
      this.queryBucket = new QueryBucket()
    } else {
      const { objects, queries } = preloadedState
      const getObjectRef = (typeName: string, plainKey: any) => {
        const type = NormalizedType.get(typeName)
        const objKey = this.objectBucket.findObjectKey(type, plainKey)!
        return new NormalizedObjectRef(type, objKey)
      }
      const readObject = (ref: NormalizedObjectRef) =>
        this.objectBucket.get(ref.type, ref.key)
      const trackQuery = (cacheKey: CacheKey, data: any, selector: Selector) =>
        this.changeTracker.setQueryData(cacheKey, data, selector, readObject)

      this.objectBucket = new ObjectBucket(objects)
      this.queryBucket = new QueryBucket(queries, getObjectRef, trackQuery)
    }
  }

  getState() {
    return {
      // note: no need to serialize ChangeTracker's data as we can derive it from QueryBucket + ObjectBucket data
      objects: this.objectBucket.getState(),
      queries: this.queryBucket.getState(),
    }
  }

  findCacheKey(query: BaseQuery) {
    return this.queryBucket.findCacheKey(query)
  }

  findCachedQueryArgs(query: Query<any, any, any>) {
    return this.queryBucket.findCachedQueryArgs(query)
  }

  get(cacheKey: CacheKey) {
    const cacheEntry = this.queryBucket.get(cacheKey)
    if (!cacheEntry) {
      return null
    }

    const { data, selector } = cacheEntry
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
    const cacheKey = existingCacheKey || new CacheKey(query.key.plain())
    let affectedCacheKeys: Set<CacheKey>
    let normalizedData: any

    const { shape, selector: userProvidedSelector } = query.options
    if (!shape) {
      // data not normalized
      this.queryBucket.set(cacheKey, {
        name: query.name,
        arguments: query.options.arguments,
        data,
        selector: null,
      })
      normalizedData = data
      affectedCacheKeys = new Set([cacheKey])
    } else {
      const normalizer = this.createNormalizer()
      const { result, objects, selector } = normalizer.normalize(data, shape)

      this.queryBucket.set(cacheKey, {
        name: query.name,
        arguments: query.options.arguments,
        data: result,
        selector: userProvidedSelector
          ? Selector.from(userProvidedSelector)
          : selector,
      })
      this.objectBucket.addObjects(objects)
      affectedCacheKeys = this.changeTracker.saveQueryData(
        cacheKey,
        toObjectKeysSet(objects)
      )
      normalizedData = result
    }

    return {
      newCacheKey: existingCacheKey ? null : cacheKey,
      normalizedData,
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
    let affectedCacheKeys: Set<CacheKey>

    if (!shape) {
      existingItem.data = mergeFn(existingData, newData)
      affectedCacheKeys = new Set([cacheKey])
    } else {
      const normalizer = this.createNormalizer()
      // prettier-ignore
      const { result, objects, selector: newSelector } = normalizer.normalize(newData, shape)
      this.objectBucket.addObjects(objects)
      if (newSelector) {
        existingSelector!.merge(newSelector)
      }
      existingItem.data = mergeFn(existingData, result)
      affectedCacheKeys = this.changeTracker.saveMoreQueryData(
        cacheKey,
        toObjectKeysSet(objects)
      )
    }

    return {
      affectedCacheKeys,
      normalizedData: existingItem.data,
    }
  }

  saveMutationResult(data: any, shape: NormalizedShape) {
    const normalizer = this.createNormalizer()
    const { result, objects } = normalizer.normalize(data, shape)
    this.objectBucket.addObjects(objects)
    const affectedCacheKeys = this.changeTracker.findAffectedCacheKeys(
      toObjectKeysSet(objects)
    )
    return {
      normalizedData: result,
      affectedCacheKeys,
    }
  }

  updateRelatedQueries(query: BaseQuery, queryResult: any) {
    const updatedCacheKeys = this.queryBucket.updateRelatedQueries(
      query,
      queryResult,
      (cacheKey, data, selector) =>
        this.changeTracker.updateQueryData(cacheKey, data, selector)
    )
    return updatedCacheKeys
  }

  updateQueriesRelatedToMutation(
    mutation: Mutation<any, any, any> | LocalMutation<any>,
    info: any
  ) {
    const updatedCacheKeys = this.queryBucket.updateQueriesRelatedToMutation(
      mutation,
      info,
      (cacheKey, data, selector) =>
        this.changeTracker.updateQueryData(cacheKey, data, selector)
    )
    return updatedCacheKeys
  }

  removeQueries(keys: CacheKey[]) {
    keys.forEach((k) => {
      this.changeTracker.removeQuery(k)
      this.queryBucket.delete(k)
    })
  }

  clear() {
    this.objectBucket.clear()
    this.queryBucket.clear()
    this.changeTracker.clear()
  }

  //============= methods called by CacheProxyImpl =========

  readQuery(query: BaseQuery) {
    const cacheKey = this.findCacheKey(query)
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
    const plainKey = typeof key === "object" ? extractPlainKey(key, type) : key
    const objectKey = this.objectBucket.findObjectKey(type, plainKey)
    return objectKey ? new NormalizedObjectRef(type, objectKey) : null
  }

  readObject(ref: NormalizedObjectRef) {
    return this.objectBucket.get(ref.type, ref.key)
  }

  updateObject(ref: NormalizedObjectRef, data: any) {
    this.objectBucket.set(ref.type, ref.key, data)

    // prettier-ignore
    const cacheKeys = this.changeTracker.findAffectedCacheKeys(new Set([ref.key]))
    cacheKeys.forEach((cacheKey) => {
      const queryBucketItem = this.queryBucket.get(cacheKey)
      if (queryBucketItem) {
        const { selector, data } = queryBucketItem
        if (data && selector) {
          this.changeTracker.updateQueryData(cacheKey, data, selector)
        }
      }
    })
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

// prettier-ignore
function toObjectKeysSet(objects: Map<NormalizedType, [NormalizedObjectKey, any][]>) {
  const objKeys: NormalizedObjectKey[] = []
  objects.forEach((objectsByType) => {
    objectsByType.forEach(([oKey]) => objKeys.push(oKey))
  })
  return new Set<NormalizedObjectKey>(objKeys)
}

export default CacheContainer

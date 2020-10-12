import { NormalizedObjectKey, NormalizedType } from "../common"
import { CacheKey } from "./QueryBucket"

export default class ChangeTracker {
  private activeQueryCacheKeys = new Set<CacheKey>()
  private queryObjectsMap = new Map<CacheKey, Set<NormalizedObjectKey>>()

  track(cacheKey: CacheKey) {
    this.activeQueryCacheKeys.add(cacheKey)
  }

  untrack(cacheKey: CacheKey) {
    this.activeQueryCacheKeys.delete(cacheKey)
  }

  findAffectedCacheKeys(
    objects: Map<NormalizedType, [NormalizedObjectKey, any][]>
  ) {
    return this._findAffectedCacheKeys(objectsMapToSet(objects))
  }

  saveQueryData(
    cacheKey: CacheKey,
    objects: Map<NormalizedType, [NormalizedObjectKey, any][]>
  ) {
    const newObjKeys = objectsMapToSet(objects)
    this.queryObjectsMap.set(cacheKey, newObjKeys)
    return this._findAffectedCacheKeys(newObjKeys, cacheKey)
  }

  saveMoreQueryData(
    cacheKey: CacheKey,
    objects: Map<NormalizedType, [NormalizedObjectKey, any][]>
  ) {
    const newObjKeys = objectsMapToSet(objects)
    const existingObjKeys = this.queryObjectsMap.get(cacheKey)!
    newObjKeys.forEach((k) => existingObjKeys.add(k))
    return this._findAffectedCacheKeys(newObjKeys, cacheKey)
  }

  private _findAffectedCacheKeys(
    objKeys: Set<NormalizedObjectKey>,
    cacheKeyInProcess?: CacheKey
  ) {
    const result: CacheKey[] = cacheKeyInProcess ? [cacheKeyInProcess] : []
    for (let ck of this.activeQueryCacheKeys) {
      if (ck === cacheKeyInProcess) {
        continue
      }

      const ckObjects = this.queryObjectsMap.get(ck)
      if (!ckObjects) {
        continue
      }

      for (let k of objKeys) {
        if (ckObjects.has(k)) {
          result.push(ck)
          break
        }
      }
    }

    return new Set(result)
  }
}

// prettier-ignore
function objectsMapToSet(objects: Map<NormalizedType, [NormalizedObjectKey, any][]>) {
  const objKeys: NormalizedObjectKey[] = []
  objects.forEach((objectsByType) => {
    objectsByType.forEach(([oKey]) => objKeys.push(oKey))
  })
  return new Set<NormalizedObjectKey>(objKeys)
}

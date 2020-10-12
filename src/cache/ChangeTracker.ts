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

  saveQueryData(
    cacheKey: CacheKey,
    objects: Map<NormalizedType, [NormalizedObjectKey, any][]>
  ) {
    const newObjKeys = objectsMapToSet(objects)
    this.queryObjectsMap.set(cacheKey, newObjKeys)

    const affectedCacheKeys: CacheKey[] = [cacheKey]
    for (let ck of this.activeQueryCacheKeys) {
      if (ck === cacheKey) {
        continue
      }

      const ckObjects = this.queryObjectsMap.get(ck)
      if (!ckObjects) {
        continue
      }

      for (let k of newObjKeys) {
        if (ckObjects.has(k)) {
          affectedCacheKeys.push(ck)
          break
        }
      }
    }

    return new Set(affectedCacheKeys)
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

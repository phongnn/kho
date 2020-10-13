import { NormalizedObjectKey } from "../common"
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

  saveQueryData(cacheKey: CacheKey, objKeys: Set<NormalizedObjectKey>) {
    this.queryObjectsMap.set(cacheKey, objKeys)
    return this.findAffectedCacheKeys(objKeys, cacheKey)
  }

  saveMoreQueryData(cacheKey: CacheKey, objKeys: Set<NormalizedObjectKey>) {
    const existingObjKeys = this.queryObjectsMap.get(cacheKey)!
    objKeys.forEach((k) => existingObjKeys.add(k))
    return this.findAffectedCacheKeys(objKeys, cacheKey)
  }

  findAffectedCacheKeys(
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

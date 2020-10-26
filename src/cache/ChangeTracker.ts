import { NormalizedObjectKey, NormalizedObjectRef } from "../common"
import { Selector } from "../normalization"
import CacheContainer from "./CacheContainer"
import { CacheKey } from "./QueryBucket"

export default class ChangeTracker {
  private activeQueryCacheKeys = new Set<CacheKey>()
  private queryObjectsMap = new Map<CacheKey, Set<NormalizedObjectKey>>()

  constructor(private cache: CacheContainer) {}

  track(cacheKey: CacheKey) {
    this.activeQueryCacheKeys.add(cacheKey)
  }

  untrack(cacheKey: CacheKey) {
    this.activeQueryCacheKeys.delete(cacheKey)
  }

  clear() {
    // note: don't clear the activeQueryCacheKeys
    this.queryObjectsMap.clear()
  }

  removeQuery(cacheKey: CacheKey) {
    this.queryObjectsMap.delete(cacheKey)
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

  updateQueryData(cacheKey: CacheKey, data: any, selector: Selector) {
    const objKeys = this.queryObjectsMap.get(cacheKey)!
    // update object keys for this cache key
    this.parseObjectTree(data, selector, objKeys, (ref) =>
      this.cache.readObject(ref)
    )
  }

  // called when restoring store from preloaded state
  setQueryData(
    cacheKey: CacheKey,
    data: any,
    selector: Selector,
    readObject: (ref: NormalizedObjectRef) => any
  ) {
    const objKeys = new Set<NormalizedObjectKey>()
    this.parseObjectTree(data, selector, objKeys, readObject)
    this.queryObjectsMap.set(cacheKey, objKeys)
  }

  // =============== private methods ======================

  private parseObjectTree(
    tree: any,
    selector: Selector,
    objKeys: Set<NormalizedObjectKey>,
    readObject: (ref: NormalizedObjectRef) => any
  ) {
    if (!tree) {
      return
    } else if (Array.isArray(tree)) {
      tree.forEach((item) =>
        this.parseObjectTree(item, selector, objKeys, readObject)
      )
    } else if (tree instanceof NormalizedObjectRef) {
      const oKey = tree.key
      // if (!objKeys.has(oKey)) {
      objKeys.add(oKey)
      const obj = readObject(tree)
      if (obj) {
        this.parseObjectTree(obj, selector, objKeys, readObject)
      }
      // }
    } else {
      for (let item of selector.iterator()) {
        if (Array.isArray(item)) {
          const [propName, subSelector] = item
          this.parseObjectTree(tree[propName], subSelector, objKeys, readObject)
        }
      }
    }
  }
}

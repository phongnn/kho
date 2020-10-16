import { CacheContainer } from "../../cache"
import {
  BaseQuery,
  CacheProxy,
  NormalizedObjectKey,
  NormalizedObjectRef,
  NormalizedType,
  Query,
} from "../../common"
import { getActualQuery } from "../../common/helpers"

/** keeps track of which normalized objects are changed by a mutation's beforeQueryUpdates() */
export default class CacheProxyImpl implements CacheProxy {
  readonly changedObjectKeys = new Set<NormalizedObjectKey>()

  constructor(private cache: CacheContainer) {}

  readQuery(query: BaseQuery) {
    const actualQuery = query instanceof Query ? getActualQuery(query) : query
    return this.cache.readQuery(actualQuery)
  }

  addObject(type: NormalizedType, data: any) {
    return this.cache.addObject(type, data)
  }

  findObjectRef(type: NormalizedType, key: any) {
    return this.cache.findObjectRef(type, key)
  }

  readObject(ref: NormalizedObjectRef) {
    return this.cache.readObject(ref)
  }

  updateObject(ref: NormalizedObjectRef, data: any) {
    this.changedObjectKeys.add(ref.key)
    this.cache.updateObject(ref, data)
  }

  deleteObject(ref: NormalizedObjectRef) {
    this.changedObjectKeys.add(ref.key)
    this.cache.deleteObject(ref)
  }
}

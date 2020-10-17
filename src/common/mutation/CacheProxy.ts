import { Query } from "../query/Query"
import { LocalQuery } from "../query/LocalQuery"
import { NormalizedType } from "../normalization/NormalizedType"
import { NormalizedObjectRef } from "../normalization/NormalizedObject"

/**
 * This interface is exposed for use only in mutations' beforeQueryUpdates().
 * Note that all methods of this interface work with normalized data, not the original data from backend.
 */
export interface CacheProxy {
  /** reads query's normalized data from cache */
  readQuery(query: Query<any, any, any> | LocalQuery<any>): any

  addObject(type: NormalizedType, data: any): NormalizedObjectRef
  findObjectRef(type: NormalizedType, key: any): NormalizedObjectRef | null
  readObject(ref: NormalizedObjectRef): any
  updateObject(ref: NormalizedObjectRef, data: any): void
  deleteObject(ref: NormalizedObjectRef): void
}

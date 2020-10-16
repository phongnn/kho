import { Query } from "../query/Query"
import { LocalQuery } from "../query/LocalQuery"
import { NormalizedType } from "../normalization/NormalizedType"
import { NormalizedObjectRef } from "../normalization/NormalizedObject"

/** Interface exposed for use only in mutations' beforeQueryUpdates() */
export interface CacheProxy {
  // prettier-ignore
  readQuery<TResult>(query: Query<TResult, any, any> | LocalQuery<TResult>): TResult
  addObject(type: NormalizedType, data: any): NormalizedObjectRef
  findObjectRef(type: NormalizedType, key: any): NormalizedObjectRef | null
  readObject(ref: NormalizedObjectRef): any
  updateObject(ref: NormalizedObjectRef, data: any): void
  deleteObject(ref: NormalizedObjectRef): void
}

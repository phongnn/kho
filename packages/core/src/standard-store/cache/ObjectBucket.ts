import { NormalizedType } from "../../NormalizedType"
import { deepEqual } from "../../helpers"

export class NormalizedObjectKey {
  constructor(private plainKey: any) {}

  matches(plainKey: any) {
    return deepEqual(plainKey, this.plainKey)
  }
}

class ObjectBucket {
  findObjectKey(
    type: NormalizedType,
    plainKey: any
  ): NormalizedObjectKey | null {
    // for (const key of this.queryData.keys()) {
    //   if (key.matches(query)) {
    //     return key
    //   }
    // }
    return null
  }

  set(type: NormalizedType, key: NormalizedObjectKey, value: any) {
    throw new Error("Method not implemented.")
  }

  get(type: NormalizedType, key: NormalizedObjectKey) {
    throw new Error("Method not implemented.")
  }
}

export default ObjectBucket

import { NormalizedType } from "./NormalizedType"
import { deepEqual } from "../common/helpers"

export class NormalizedObjectKey {
  constructor(private plainKey: any) {}

  matches(plainKey: any) {
    if (typeof plainKey === "object" && typeof this.plainKey === "object") {
      return deepEqual(plainKey, this.plainKey)
    } else {
      return plainKey === this.plainKey
    }
  }
}

export class NormalizedObjectRef {
  constructor(
    readonly type: NormalizedType,
    readonly key: NormalizedObjectKey
  ) {}
}

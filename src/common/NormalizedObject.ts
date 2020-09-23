import { NormalizedType } from "./NormalizedType"
import { deepEqual } from "./helpers"

export class NormalizedObjectKey {
  constructor(private plainKey: any) {}

  matches(plainKey: any) {
    return deepEqual(plainKey, this.plainKey)
  }
}

export class NormalizedObjectRef {
  constructor(
    readonly type: NormalizedType,
    readonly key: NormalizedObjectKey
  ) {}
}

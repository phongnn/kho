import { NormalizedType } from "../../NormalizedType"
import { deepEqual } from "../../helpers"

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

class ObjectBucket {
  private objects = new Map<NormalizedType, Map<NormalizedObjectKey, any>>()

  findObjectKey(
    type: NormalizedType,
    plainKey: any
  ): NormalizedObjectKey | null {
    const objectMap = this.objects.get(type)
    if (!objectMap) {
      return null
    }

    for (const key of objectMap.keys()) {
      if (key.matches(plainKey)) {
        return key
      }
    }
    return null
  }

  get(type: NormalizedType, key: NormalizedObjectKey) {
    return this.objects.get(type)?.get(key)
  }

  add(newObjects: Map<NormalizedType, [NormalizedObjectKey, any][]>) {
    for (const [type, entries] of newObjects) {
      const existingMap =
        this.objects.get(type) || new Map<NormalizedObjectKey, any>()
      for (const [key, obj] of entries) {
        existingMap.set(key, obj)
      }
      this.objects.set(type, existingMap)
    }
  }
}

export default ObjectBucket

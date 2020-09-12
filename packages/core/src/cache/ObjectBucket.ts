import { NormalizedType } from "../normalization/NormalizedType"
import { NormalizedObjectKey } from "../normalization/NormalizedObject"

class ObjectBucket {
  private objects = new Map<NormalizedType, Map<NormalizedObjectKey, any>>()

  findObjectKey(type: NormalizedType, plainKey: any) {
    const objectMap = this.objects.get(type)
    if (objectMap) {
      for (const key of objectMap.keys()) {
        if (key.matches(plainKey)) {
          return key
        }
      }
    }

    return null
  }

  get(type: NormalizedType, key: NormalizedObjectKey) {
    return this.objects.get(type)?.get(key)
  }

  set(type: NormalizedType, key: NormalizedObjectKey, value: any) {
    const existingMap = this.objects.get(type)
    if (!existingMap) {
      this.objects.set(
        type,
        new Map<NormalizedObjectKey, any>([[key, value]])
      )
    } else {
      existingMap.set(key, value)
    }
  }

  addObjects(newObjects: Map<NormalizedType, [NormalizedObjectKey, any][]>) {
    for (const [type, entries] of newObjects) {
      const existingMap = this.objects.get(type)
      if (!existingMap) {
        this.objects.set(type, new Map<NormalizedObjectKey, any>(entries))
      } else {
        entries.forEach(([key, obj]) => {
          const existingObj = existingMap.get(key)
          existingMap.set(
            key,
            !existingObj ? obj : Object.assign({}, existingObj, obj)
          )
        })
      }
    }
  }

  delete(type: NormalizedType, key: NormalizedObjectKey) {
    this.objects.get(type)?.delete(key)
  }

  clear() {
    this.objects.clear()
  }
}

export default ObjectBucket

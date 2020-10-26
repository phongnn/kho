import {
  NormalizedType,
  NormalizedObjectKey,
  NormalizedObjectRef,
} from "../common"
import { extractPlainKey } from "../common/helpers"
import { deserializeData, serializeData } from "./DataSerializer"

interface SerializableObjectList {
  type: string
  objects: any[]
}

function parsePreloadedState(state: SerializableObjectList[]) {
  const objKeys = new Map<string, NormalizedObjectKey[]>()
  const getObjKey = (typeName: string, plainKey: any) => {
    const existingKeys = objKeys.get(typeName)
    if (!existingKeys) {
      const newKey = new NormalizedObjectKey(plainKey)
      objKeys.set(typeName, [newKey])
      return newKey
    }

    const existingKey = existingKeys.find((k) => k.matches(plainKey))
    if (existingKey) {
      return existingKey
    }

    const newKey = new NormalizedObjectKey(plainKey)
    existingKeys.push(newKey)
    return newKey
  }

  const getObjectRef = (typeName: string, plainKey: any) => {
    const type = NormalizedType.get(typeName)
    const oKey = getObjKey(typeName, plainKey)
    return new NormalizedObjectRef(type, oKey)
  }

  const result = new Map<NormalizedType, Map<NormalizedObjectKey, any>>()
  state.forEach(({ type: typeName, objects: plainObjects }) => {
    const type = NormalizedType.get(typeName)
    const restoredObjects = new Map(
      plainObjects.map((obj) => [
        getObjKey(typeName, extractPlainKey(obj, type)),
        deserializeData(obj, getObjectRef),
      ])
    )
    result.set(type, restoredObjects)
  })
  return result
}

class ObjectBucket {
  private objects: Map<NormalizedType, Map<NormalizedObjectKey, any>>

  constructor(preloadedState?: SerializableObjectList[]) {
    this.objects = preloadedState
      ? parsePreloadedState(preloadedState)
      : new Map<NormalizedType, Map<NormalizedObjectKey, any>>()
  }

  getState(): any {
    const result: SerializableObjectList[] = []
    this.objects.forEach((objMap, type) => {
      const list: any[] = []
      objMap.forEach((o) => list.push(serializeData(o)))
      if (list.length > 0) {
        result.push({
          type: type.name,
          objects: list,
        })
      }
    })
    return result
  }

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

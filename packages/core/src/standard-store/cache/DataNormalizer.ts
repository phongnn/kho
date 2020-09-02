import {
  NormalizedType,
  NormalizedTypeShapeValue,
  NormalizedTypePlaceholder,
  RecordOf,
} from "../../NormalizedType"
import { NormalizedObjectKey, NormalizedObjectRef } from "./ObjectBucket"
import Selector from "./Selector"

type NormalizedStructure =
  | any
  | NormalizedObjectRef
  | Array<any | NormalizedObjectRef>

type NormalizedObjects = Map<NormalizedType, Array<[NormalizedObjectKey, any]>>

function extractPlainKey(obj: any, type: NormalizedType) {
  const result: any = {}

  type.keyFields.forEach((f) => {
    if (!obj[f]) {
      throw new Error(
        `[FNC] Data of type "${type.name}" must contain key field "${f}".`
      )
    }
    result[f] = obj[f]
  })

  return result
}

function addNormalizedObjects(
  type: NormalizedType,
  newObjects: [NormalizedObjectKey, any][],
  existingObjects: NormalizedObjects
) {
  const existingList = existingObjects.get(type)
  if (!existingList) {
    existingObjects.set(type, newObjects)
  } else {
    newObjects.forEach((co) => existingList.push(co))
  }
}

function mergeNormalizedObjects(
  newObjects: NormalizedObjects,
  existingObjects: NormalizedObjects
) {
  for (const [type, objects] of newObjects.entries()) {
    addNormalizedObjects(type, objects, existingObjects)
  }
}

class DataNormalizer {
  constructor(
    private lookupObjectKey: (
      type: NormalizedType,
      plainKey: any
    ) => NormalizedObjectKey | null
  ) {}

  normalize(data: any, shape: NormalizedTypeShapeValue) {
    if (Array.isArray(shape)) {
      if (shape.length !== 1) {
        throw new Error(
          `[FNC] Normalized type array must have exactly one element.`
        )
      }
      return this.normalizeArray(data, shape[0])
    } else {
      return this.normalizeObject(data, shape)
    }
  }

  private normalizeObject(
    data: any,
    shape:
      | NormalizedType
      | NormalizedTypePlaceholder
      | RecordOf<NormalizedTypeShapeValue>
  ) {
    if (!data) {
      return {
        result: null,
        objects: new Map() as NormalizedObjects,
        selector: new Selector(),
      }
    }

    if (shape instanceof NormalizedType) {
      return this.normalizeTypedObject(data, shape)
    } else if (shape instanceof NormalizedTypePlaceholder) {
      return this.normalizeTypedObject(data, shape.getType())
    } else {
      return this.normalizeUntypedObject(data, shape)
    }
  }

  private normalizeTypedObject(data: any, type: NormalizedType) {
    const plainKey = extractPlainKey(data, type)
    const objectKey =
      this.lookupObjectKey(type, plainKey) || new NormalizedObjectKey(plainKey)

    const normalizedObjRef = new NormalizedObjectRef(type, objectKey)
    const normalizedObj: any = {}
    const selector = new Selector()
    const objects: NormalizedObjects = new Map()

    Object.getOwnPropertyNames(data).forEach((prop) => {
      if (!type.shape || !type.shape[prop]) {
        normalizedObj[prop] = data[prop]
        selector.push(prop)
      } else {
        const child = this.normalize(data[prop], type.shape[prop])
        normalizedObj[prop] = child.result
        selector.push([prop, child.selector])
        for (const [childObjType, childObjects] of child.objects) {
          addNormalizedObjects(childObjType, childObjects, objects)
        }
      }
    })

    addNormalizedObjects(type, [[objectKey, normalizedObj]], objects)

    return {
      result: normalizedObjRef,
      objects,
      selector,
    }
  }

  private normalizeUntypedObject(
    data: any,
    shape: RecordOf<NormalizedTypeShapeValue>
  ) {
    let result: NormalizedStructure = {}
    const objects: NormalizedObjects = new Map()
    const selector = new Selector()

    Object.getOwnPropertyNames(data).forEach((prop) => {
      if (!shape[prop]) {
        result[prop] = data[prop]
        selector.push(prop)
      } else {
        const child = this.normalize(data[prop], shape[prop])
        result[prop] = child.result
        selector.push([prop, child.selector])
        for (const [childObjType, childObjects] of child.objects) {
          addNormalizedObjects(childObjType, childObjects, objects)
        }
      }
    })

    return { result, objects, selector }
  }

  private normalizeArray(
    data: any[],
    itemType:
      | NormalizedType
      | NormalizedTypePlaceholder
      | RecordOf<NormalizedTypeShapeValue>
  ) {
    if (data && !Array.isArray(data)) {
      const typeName =
        typeof itemType.name === "string" ? itemType.name : "unknown"
      throw new Error(`[FNC] Data is not an array of ${typeName} as expected.`)
    }

    if (!data || data.length === 0) {
      return {
        result: [],
        objects: new Map() as NormalizedObjects,
        selector: new Selector(),
      }
    }

    const result: Array<{} | NormalizedObjectRef> = []
    const objects: NormalizedObjects = new Map()
    const selector = new Selector()

    data.forEach((dataItem) => {
      const child = this.normalizeObject(dataItem, itemType)
      if (!child.result) {
        return
      }
      result.push(child.result)
      mergeNormalizedObjects(child.objects, objects)
      selector.merge(child.selector)
    })

    return { result, objects, selector }
  }
}

export default DataNormalizer

import {
  NormalizedType,
  NormalizedObjectKey,
  NormalizedObjectRef,
} from "../common"
import Selector from "./Selector"

export default class DataDenormalizer {
  constructor(
    private lookupObject: (
      type: NormalizedType,
      key: NormalizedObjectKey
    ) => any
  ) {}

  denormalize(normalizedData: any, selector: Selector): any {
    if (Array.isArray(normalizedData)) {
      return normalizedData
        .map((dataItem) => this.denormalize(dataItem, selector))
        .filter((dataItem) => !!dataItem)
    } else if (normalizedData instanceof NormalizedObjectRef) {
      const obj = this.lookupObject(normalizedData.type, normalizedData.key)
      return !obj ? null : this.denormalizeObject(obj, selector)
    } else if (typeof normalizedData === "object") {
      return this.denormalizeObject(normalizedData, selector)
    } else {
      return normalizedData ?? null // undefined -> null
    }
  }

  private denormalizeObject(obj: any, selector: Selector) {
    const result: any = {}
    for (const item of selector.iterator()) {
      if (typeof item === "string") {
        if (obj[item] !== undefined) {
          result[item] = obj[item]
        }
      } else {
        const [propName, subSelector] = item
        result[propName] = this.denormalize(obj[propName], subSelector)
      }
    }
    return result
  }
}

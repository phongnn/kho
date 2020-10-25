import {
  NormalizedType,
  NormalizedObjectKey,
  NormalizedObjectRef,
} from "../common"
import Selector from "./Selector"

export default class DataDenormalizer {
  constructor(
    // prettier-ignore
    private lookupObject: (type: NormalizedType, key: NormalizedObjectKey) => any
  ) {}

  // prettier-ignore
  denormalize(normalizedData: any, selector: Selector): any {
    if (Array.isArray(normalizedData)) {
      return normalizedData
        .map((dataItem) => this.denormalize(dataItem, selector))
        .filter((dataItem) => !!dataItem)
    } else if (normalizedData instanceof NormalizedObjectRef) {
      const obj = this.lookupObject(normalizedData.type, normalizedData.key)
      return !obj ? null : this.denormalizeObject(obj, selector, normalizedData.type.transform)
    } else if (typeof normalizedData === "object") {
      return this.denormalizeObject(normalizedData, selector)
    } else {
      return normalizedData ?? null
    }
  }

  // prettier-ignore
  private denormalizeObject(obj: any, selector: Selector, transform?: Record<string, (value: any) => any>) {
    const result: any = {}
    for (const item of selector.iterator()) {
      if (typeof item === "string") {
        if (transform && transform[item]) {
          const fn = transform[item]
          const val = fn(obj[item])
          if (val !== undefined) {
            result[item] = val
          }
        } else if (obj[item] !== undefined) {
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

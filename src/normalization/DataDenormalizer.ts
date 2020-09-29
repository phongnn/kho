// prettier-ignore
import { NormalizedType, NormalizedObjectKey, NormalizedObjectRef, TransformShape } from "../common"
import Selector from "./Selector"

export default class DataDenormalizer {
  constructor(
    // prettier-ignore
    private lookupObject: (type: NormalizedType, key: NormalizedObjectKey) => any
  ) {}

  // prettier-ignore
  denormalize(normalizedData: any, selector: Selector, transformer?: TransformShape): any {
    if (Array.isArray(normalizedData)) {
      if (transformer && !Array.isArray(transformer)) {
        throw new Error("[Kho] Invalid transform configuration: array expected.")
      }

      return normalizedData
        .map((dataItem) =>
          this.denormalize(
            dataItem,
            selector,
            transformer ? transformer[0] : undefined
          )
        )
        .filter((dataItem) => !!dataItem)
    } else if (normalizedData instanceof NormalizedObjectRef) {
      const obj = this.lookupObject(normalizedData.type, normalizedData.key)
      return !obj ? null : this.denormalizeObject(obj, selector, normalizedData.type.transform)
    } else if (typeof normalizedData === "object") {
      return this.denormalizeObject(normalizedData, selector, transformer)
    } else {
      return typeof transformer === "function"
        ? transformer(normalizedData)
        : normalizedData ?? null
    }
  }

  // prettier-ignore
  private denormalizeObject(obj: any, selector: Selector, transformer?: TransformShape) {
    const result: any = {}

    if (transformer && (Array.isArray(transformer) || typeof transformer === "function")) {
      throw new Error(
        `[Kho] Invalid transform configuration: object expected instead of ${ Array.isArray(transformer) ? "array" : "function" }.`
      )
    }

    for (const item of selector.iterator()) {
      if (typeof item === "string") {
        if (transformer && transformer[item]) {
          const fn = transformer[item]
          if (typeof fn !== "function") {
            throw new Error(`[Kho] Invalid transform configuration: function expected.`)
          }

          const val = fn(obj[item])
          if (val !== undefined) {
            result[item] = val
          }
        } else if (obj[item] !== undefined) {
          result[item] = obj[item]
        }
      } else {
        const [propName, subSelector] = item
        result[propName] = this.denormalize(
          obj[propName],
          subSelector,
          transformer ? transformer[propName] : undefined
        )
      }
    }
    return result
  }
}

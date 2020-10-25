import { NormalizedObjectRef } from "../common"

export function serializeData(data: any): any {
  if (Array.isArray(data)) {
    return data.map((item) => serializeData(item))
  } else if (data instanceof NormalizedObjectRef) {
    return {
      __type__: data.type.name,
      __key__: data.key.plain(),
    }
  } else if (typeof data === "object") {
    const result: any = {}
    Object.getOwnPropertyNames(data).forEach(
      (propName) => (result[propName] = serializeData(data[propName]))
    )
    return result
  } else {
    return data
  }
}

export function deserializeData(
  data: any,
  getObjectRef: (typeName: string, plainKey: any) => NormalizedObjectRef
): any {
  if (Array.isArray(data)) {
    return data.map((item) => deserializeData(item, getObjectRef))
  }

  const { __type__, __key__ } = data
  if (__type__ && __key__) {
    return getObjectRef(__type__, __key__)
  } else if (typeof data === "object") {
    const result: any = {}
    Object.getOwnPropertyNames(data).forEach(
      (propName) =>
        (result[propName] = deserializeData(data[propName], getObjectRef))
    )
    return result
  } else {
    return data
  }
}

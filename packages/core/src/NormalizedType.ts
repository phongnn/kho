type NormalizedTypeShape = Record<string, string | [string]>
type NormalizedTypeShapeSettings = Record<
  string,
  string | NormalizedType | [string | NormalizedType]
>

function replaceTypesByNames(shape: NormalizedTypeShapeSettings) {
  const result: NormalizedTypeShape = {}
  Object.entries(shape).forEach(([field, type]) => {
    result[field] =
      type instanceof NormalizedType
        ? type.name
        : Array.isArray(type)
        ? [type[0] instanceof NormalizedType ? type[0].name : type[0]]
        : type
  })
  return result
}

export class NormalizedType {
  static typeRegistry: Map<string, NormalizedType> = new Map()

  static register(
    name: string,
    settings: {
      shape?: NormalizedTypeShapeSettings
      keyFields?: string[]
    } = {}
  ) {
    if (this.typeRegistry.has(name)) {
      throw new Error(`Normalized type already exists: ${name}`)
    }

    const keyFields = settings.keyFields || ["id"]
    const newType = !settings.shape
      ? new NormalizedType(name, keyFields)
      : new NormalizedType(name, keyFields, replaceTypesByNames(settings.shape))
    this.typeRegistry.set(name, newType)

    return newType
  }

  static lookup(name: string) {
    return this.typeRegistry.get(name)
  }

  private constructor(
    readonly name: string,
    readonly keyFields: string[],
    readonly shape?: NormalizedTypeShape
  ) {}
}

export type NormalizedShape = Record<string, NormalizedType | [NormalizedType]>

// type NormalizedTypeShape = Record<
//   string,
//   NormalizedType | string | [NormalizedType | string]
// >

// const nameToType = (name: string) => NormalizedType.lookup(name) || name

// function replaceNamesByTypes(shape: NormalizedTypeShape) {
//   const result: NormalizedTypeShape = {}
//   Object.entries(shape).forEach(([field, type]) => {
//     result[field] =
//       typeof type === "string"
//         ? nameToType(type)
//         : Array.isArray(type)
//         ? [typeof type[0] === "string" ? nameToType(type[0]) : type[0]]
//         : type
//   })
//   return result
// }

// function replaceNameByType(
//   shape: NormalizedTypeShape,
//   newTypeName: string,
//   newType: NormalizedType
// ) {
//   let converted = false
//   const result: NormalizedTypeShape = {}
//   Object.entries(shape).forEach(([field, type]) => {
//     if (type === newTypeName) {
//       result[field] = newType
//       converted = true
//     } else if (Array.isArray(type) && type[0] === newTypeName) {
//       result[field] = [newType]
//       converted = true
//     } else {
//       result[field] = shape[field]
//     }
//   })
//   return converted ? result : shape
// }

// export class NormalizedType {
//   static typeRegistry: Map<string, NormalizedType> = new Map()

//   static register(
//     name: string,
//     settings: {
//       shape?: NormalizedTypeShape
//       keyFields?: string[]
//     } = {}
//   ) {
//     if (this.typeRegistry.has(name)) {
//       throw new Error(`Normalized type already exists: ${name}`)
//     }

//     const keyFields = settings.keyFields || ["id"]
//     let newType = !settings.shape
//       ? new NormalizedType(name, keyFields)
//       : new NormalizedType(name, keyFields, replaceNamesByTypes(settings.shape))

//     this.typeRegistry.set(name, newType)

//     // replace new type's name with the newType object within previously defined types
//     for (const [typeName, typeObj] of this.typeRegistry.entries()) {
//       if (typeObj.shape) {
//         const shape = replaceNameByType(typeObj.shape, name, newType)
//         if (shape !== typeObj.shape) {
//           this.typeRegistry.set(
//             typeName,
//             new NormalizedType(typeName, typeObj.keyFields, shape)
//           )
//         }
//       }
//     }
//   }

//   static lookup(name: string) {
//     return this.typeRegistry.get(name)
//   }

//   private constructor(
//     readonly name: string,
//     readonly keyFields: string[],
//     readonly shape?: NormalizedTypeShape
//   ) {}
// }

// export type NormalizedShape = Record<string, NormalizedType | [NormalizedType]>

export interface RecordOf<T> {
  [k: string]: T
}

type NormalizedTypeShape = RecordOf<NormalizedTypeShapeValue>
export type NormalizedTypeShapeValue =
  | NormalizedType
  | NormalizedTypePlaceholder
  | RecordOf<NormalizedTypeShapeValue>
  | [
      | NormalizedType
      | NormalizedTypePlaceholder
      | RecordOf<NormalizedTypeShapeValue>
    ]

export class NormalizedTypePlaceholder {
  constructor(readonly name: string, readonly getType: () => NormalizedType) {}
}

export class NormalizedType {
  private static typeRegistry: Map<string, NormalizedType> = new Map()

  static register(
    name: string,
    settings: {
      shape?: NormalizedTypeShape
      keyFields?: string[]
    } = {}
  ) {
    if (this.typeRegistry.has(name)) {
      throw new Error(`Normalized type already exists: ${name}`)
    }
    const newType = new NormalizedType(
      name,
      settings.keyFields || ["id"],
      settings.shape
    )
    this.typeRegistry.set(name, newType)
    return newType
  }

  static of(name: string) {
    return new NormalizedTypePlaceholder(name, () => {
      const type = this.typeRegistry.get(name)
      if (!type) {
        throw new Error(`[FNC] Normalized type not found: ${name}.`)
      }
      return type
    })
  }

  private constructor(
    readonly name: string,
    readonly keyFields: string[],
    readonly shape?: NormalizedTypeShape
  ) {}
}

/** Shape of a query's result */
export type NormalizedShape =
  | NormalizedType
  | RecordOf<NormalizedShape>
  | [NormalizedType | RecordOf<NormalizedShape>]

/**
 * Allows developers to define the shape of a normalized type using previously defined types
 * (in the same way it's required to define the shape of a query's result). Under the hood,
 * we will convert all type references to using names so it's standardized between normal cases
 * and when we have circular references among types.
 */

// type NormalizedTypeShape = RecordOf<NormalizedTypeShapeValue>
// type NormalizedTypeShapeValue =
//   | string
//   | RecordOf<NormalizedTypeShapeValue>
//   | [string | RecordOf<NormalizedTypeShapeValue>]

// type NormalizedTypeShapeSettings = RecordOf<NormalizedTypeShapeSettingsValue>
// type NormalizedTypeShapeSettingsValue =
//   | string
//   | NormalizedType
//   | RecordOf<NormalizedTypeShapeSettingsValue>
//   | [string | NormalizedType | RecordOf<NormalizedTypeShapeSettingsValue>]

// /** converts NormalizedTypeShapeSettings to NormalizedTypeShape */
// function replaceTypeObjectsByNames(shape: NormalizedTypeShapeSettings) {
//   const result: NormalizedTypeShape = {}
//   Object.entries(shape).forEach(([field, type]) => {
//     result[field] =
//       type instanceof NormalizedType
//         ? type.name
//         : Array.isArray(type)
//         ? [
//             type[0] instanceof NormalizedType
//               ? type[0].name
//               : typeof type[0] === "string"
//               ? type[0]
//               : replaceTypeObjectsByNames(type[0]),
//           ]
//         : typeof type === "string"
//         ? type
//         : replaceTypeObjectsByNames(type)
//   })
//   return result
// }

// export class NormalizedType {
//   private static typeRegistry: Map<string, NormalizedType> = new Map()

//   static register(
//     name: string,
//     settings: {
//       shape?: NormalizedTypeShapeSettings
//       keyFields?: string[]
//     } = {}
//   ) {
//     if (this.typeRegistry.has(name)) {
//       throw new Error(`Normalized type already exists: ${name}`)
//     }

//     const keyFields = settings.keyFields || ["id"]
//     const newType = !settings.shape
//       ? new NormalizedType(name, keyFields)
//       : new NormalizedType(
//           name,
//           keyFields,
//           replaceTypeObjectsByNames(settings.shape)
//         )
//     this.typeRegistry.set(name, newType)

//     return newType
//   }

//   private constructor(
//     readonly name: string,
//     readonly keyFields: string[],
//     readonly shape?: NormalizedTypeShape
//   ) {}
// }

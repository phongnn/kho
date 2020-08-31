interface RecordI<T> {
  [k: string]: T
}

type NormalizedTypeShape = RecordI<NormalizedTypeShapeValue>
type NormalizedTypeShapeValue =
  | string
  | RecordI<NormalizedTypeShapeValue>
  | [string | RecordI<NormalizedTypeShapeValue>]

type NormalizedTypeShapeSettings = RecordI<NormalizedTypeShapeSettingsValue>
type NormalizedTypeShapeSettingsValue =
  | string
  | NormalizedType
  | RecordI<NormalizedTypeShapeSettingsValue>
  | [string | NormalizedType | RecordI<NormalizedTypeShapeSettingsValue>]

/**
 * Allows developers to define the shape of a normalized type using previously defined types
 * (in the same way it's required to define the shape of a query's result). Under the hood,
 * we will convert all type references to using names so it's standardized between normal cases
 * and when we have circular references among types.
 */
function replaceTypesByNames(shape: NormalizedTypeShapeSettings) {
  const result: NormalizedTypeShape = {}
  Object.entries(shape).forEach(([field, type]) => {
    result[field] =
      type instanceof NormalizedType
        ? type.name
        : Array.isArray(type)
        ? [
            type[0] instanceof NormalizedType
              ? type[0].name
              : typeof type[0] === "string"
              ? type[0]
              : replaceTypesByNames(type[0]),
          ]
        : typeof type === "string"
        ? type
        : replaceTypesByNames(type)
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

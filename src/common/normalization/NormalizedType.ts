interface RecordOf<T> {
  [k: string]: T
}

export class NormalizedTypePlaceholder {
  constructor(readonly name: string, readonly getType: () => NormalizedType) {}
}

export class NormalizedType {
  private static registry: Map<string, NormalizedType> = new Map()

  static register(
    name: string,
    settings: {
      shape?: NormalizedTypeShape
      keyFields?: string[]
      transform?: Record<string, (value: any) => any>
    } = {}
  ) {
    if (this.registry.has(name)) {
      throw new Error(`Normalized type already exists: ${name}`)
    }
    const newType = new NormalizedType(
      name,
      settings.keyFields || ["id"],
      settings.shape,
      settings.transform
    )
    this.registry.set(name, newType)
    return newType
  }

  /**
   * use this method if you need to refer to a normalized type that hasn't been defined yet
   * (e.g. due to a circular dependency)
   */
  static of(name: string) {
    return new NormalizedTypePlaceholder(name, () => this.get(name))
  }

  static get(name: string) {
    const type = this.registry.get(name)
    if (!type) {
      throw new Error(`[Kho] Normalized type not found: ${name}.`)
    }
    return type
  }

  private constructor(
    readonly name: string,
    readonly keyFields: string[],
    readonly shape?: NormalizedTypeShape,
    readonly transform?: Record<string, (value: any) => any>
  ) {}
}

export type NormalizedTypeShape = RecordOf<NormalizedTypeShapeValue>
type NormalizedTypeShapeValue =
  | NormalizedType
  | NormalizedTypePlaceholder
  | NormalizedTypeShape
  | [NormalizedType | NormalizedTypePlaceholder | NormalizedTypeShape]

/** Shape of a query's result */
export type NormalizedShape =
  | NormalizedType
  | RecordOf<NormalizedShape>
  | [NormalizedType | RecordOf<NormalizedShape>]

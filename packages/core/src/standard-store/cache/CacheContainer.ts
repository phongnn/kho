import { BaseQuery } from "../../Query"
import QueryBucket, { CacheKey } from "./QueryBucket"
import ObjectBucket, { NormalizedObjectKey } from "./ObjectBucket"
import DataNormalizer from "./DataNormalizer"
import { NormalizedType } from "../../NormalizedType"
import DataDenormalizer from "./DataDenormalizer"

export { CacheKey } from "./QueryBucket"

// TODO: provide a mechanism to serialize and deserialize CacheContainer.
class CacheContainer {
  private queryBucket = new QueryBucket()
  private objectBucket = new ObjectBucket()

  findCacheKey(query: BaseQuery) {
    return this.queryBucket.findCacheKey(query)
  }

  get(cacheKey: CacheKey) {
    const cacheEntry = this.queryBucket.get(cacheKey)
    if (!cacheEntry) {
      return null
    }

    const [data, selector] = cacheEntry
    if (!selector) {
      return data
    }

    const denormalizer = new DataDenormalizer(
      (type: NormalizedType, key: NormalizedObjectKey) =>
        this.objectBucket.get(type, key)
    )

    return denormalizer.denormalize(data, selector)
  }

  save(query: BaseQuery, data: any) {
    const cacheKey = this.findCacheKey(query) || new CacheKey(query)

    const { shape } = query.options
    if (!shape) {
      this.queryBucket.set(cacheKey, [data, null]) // data not normalized -> no selector
    } else {
      const normalizer = new DataNormalizer(
        (type: NormalizedType, plainKey: any) =>
          this.objectBucket.findObjectKey(type, plainKey)
      )
      const { result, objects, selector } = normalizer.normalize(data, shape)

      this.queryBucket.set(cacheKey, [result, selector])
      this.objectBucket.add(objects)
    }

    return cacheKey
  }
}

export default CacheContainer

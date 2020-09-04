import { BaseQuery } from "../query/BaseQuery"
import QueryBucket, { CacheKey } from "./QueryBucket"
import ObjectBucket from "./ObjectBucket"
import DataNormalizer from "../normalization/DataNormalizer"
import DataDenormalizer from "../normalization/DataDenormalizer"

export { CacheKey } from "./QueryBucket"

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

    const denormalizer = new DataDenormalizer((type, key) =>
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
      const normalizer = new DataNormalizer((type, plainKey) =>
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

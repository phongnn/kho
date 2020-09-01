import { Query, BaseQuery } from "../../Query"
import QueryBucket, { CacheKey } from "./QueryBucket"
import DataNormalizer from "./DataNormalizer"
import ObjectBucket from "./ObjectBucket"
import { NormalizedType } from "../../NormalizedType"

class ActiveQuery<TResult> {
  constructor(
    readonly query: BaseQuery<TResult>,
    readonly onData: (data: TResult) => void,
    readonly cacheKey?: CacheKey
  ) {}
}

class InMemoryCache {
  private activeQueries: ActiveQuery<any>[] = []
  private queryBucket = new QueryBucket()
  private objectBucket = new ObjectBucket()
  private normalizer = new DataNormalizer(
    (type: NormalizedType, plainKey: any) =>
      this.objectBucket.findObjectKey(type, plainKey)
  )

  /** returns true if query's data is already in cache */
  subscribe<TResult>(
    query: BaseQuery<TResult>,
    onData: (data: TResult) => void
  ) {
    const cacheKey = this.queryBucket.findCacheKey(query)
    if (cacheKey) {
      this.activeQueries.push(new ActiveQuery(query, onData, cacheKey))

      // query's data already in cache -> callback immediately
      onData(this.queryBucket.get(cacheKey))
      return true
    } else {
      this.activeQueries.push(new ActiveQuery(query, onData))
      return false
    }
  }

  unsubscribe<TResult>(query: BaseQuery<TResult>) {
    this.activeQueries = this.activeQueries.filter((aq) => aq.query !== query)
  }

  storeFetchedData<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    fetchedData: TResult
  ): void {
    if (!fetchedData) {
      return
    }

    // TODO: encapsulate queryBucket and objectBucket in CacheState class.
    // To enable time travelling, don't mutate CacheState but return a new instance instead.
    // Provide a mechanism to serialize and deserialize CacheState.

    // TODO: put the normalizer inside the CacheState instead
    // TODO: return the selector as part of the normalization result?
    let cacheKey: CacheKey
    if (
      query.options.shape
    ) {
      // prettier-ignore
      // const [normalizedQueryResult, normalizedObjects] = this.normalizer.normalize(fetchedData, query.options.shape)

      // for (const [type, objects] of normalizedObjects.entries()) {
      //   objects.forEach(([key, value]) =>
      //     this.objectBucket.set(type, key, value)
      //   )
      // }
      // cacheKey = this.queryBucket.set(query, normalizedQueryResult)
    } else {
      cacheKey = this.queryBucket.set(query, fetchedData)
    }

    // set cacheKey for those active queries that are pending for data fetching
    this.activeQueries = this.activeQueries.map((aq) =>
      !!aq.cacheKey || !cacheKey.matches(aq.query)
        ? aq
        : new ActiveQuery(aq.query, aq.onData, cacheKey)
    )

    // notify active queries of possible state change
    this.activeQueries.forEach(
      (aq) => aq.cacheKey && aq.onData(this.queryBucket.get(aq.cacheKey))
    )
  }
}

export default InMemoryCache

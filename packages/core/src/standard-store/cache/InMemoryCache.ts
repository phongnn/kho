import { Query, BaseQuery } from "../../Query"
import QueryBucket, { CacheKey } from "./QueryBucket"

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
    const cacheKey = this.queryBucket.set(query, fetchedData)

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

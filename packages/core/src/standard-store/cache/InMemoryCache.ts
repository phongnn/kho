import { Query, BaseQuery } from "../../Query"
import CacheContainer, { CacheKey } from "./CacheContainer"

class ActiveQuery<TResult> {
  constructor(
    readonly query: BaseQuery,
    readonly onData: (data: TResult) => void,
    readonly cacheKey?: CacheKey
  ) {}
}

class InMemoryCache {
  private activeQueries: ActiveQuery<any>[] = []
  private cache = new CacheContainer()

  /** returns true if query's data is already in cache */
  subscribe<TResult>(query: BaseQuery, onData: (data: TResult) => void) {
    const cacheKey = this.cache.findCacheKey(query)
    if (cacheKey) {
      this.activeQueries.push(new ActiveQuery(query, onData, cacheKey))
      // callback immediately
      onData(this.cache.get(cacheKey))
      return true
    } else {
      this.activeQueries.push(new ActiveQuery(query, onData))
      return false
    }
  }

  unsubscribe<TResult>(query: BaseQuery) {
    this.activeQueries = this.activeQueries.filter((aq) => aq.query !== query)
  }

  storeFetchedData<TResult, TArguments, TContext>(
    query: Query<TResult, TArguments, TContext>,
    fetchedData: TResult
  ): void {
    if (!fetchedData) {
      return
    }

    const cacheKey = this.cache.save(query, fetchedData)

    // set cacheKey for those active queries that are pending for data fetching
    this.activeQueries = this.activeQueries.map((aq) =>
      !!aq.cacheKey || !cacheKey.matches(aq.query)
        ? aq
        : new ActiveQuery(aq.query, aq.onData, cacheKey)
    )

    // notify active queries of possible state change
    this.activeQueries.forEach(
      (aq) => aq.cacheKey && aq.onData(this.cache.get(aq.cacheKey))
    )
  }
}

export default InMemoryCache

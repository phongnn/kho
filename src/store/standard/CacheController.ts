// prettier-ignore
import { BaseQuery, Query, LocalQuery, CompoundQuery, Mutation } from "../../common"
import { CacheContainer, CacheKey } from "../../cache"

interface ActiveQueryInfo {
  readonly onData: (data: any) => void
  cacheKey?: CacheKey
}

class CacheController {
  private activeQueries = new Map<BaseQuery, ActiveQueryInfo>()
  private cache = new CacheContainer()

  /** returns true if query's data is already in cache */
  subscribe(query: BaseQuery, onData: (data: any) => void) {
    const cacheKey = this.cache.findCacheKey(query)
    if (cacheKey) {
      // already cached
      this.activeQueries.set(query, { onData, cacheKey })
      this.cache.changeTracker.track(cacheKey)

      const existingData = this.cache.get(cacheKey)
      setTimeout(() => onData(existingData)) // callback right after subscription
      return true
    } else if (query instanceof LocalQuery) {
      const { initialValue = null } = query.options
      const { newCacheKey, affectedCacheKeys } = this.cache.saveQueryData(
        query,
        initialValue
      )
      this.activeQueries.set(query, { onData, cacheKey: newCacheKey! })
      this.cache.changeTracker.track(newCacheKey!)

      if (initialValue) {
        // setTimeout(() => onData(initialValue))
        setTimeout(() => this.new_notifyActiveQueries(affectedCacheKeys))
      }
      return true
    } else {
      this.activeQueries.set(query, { onData })
      return false
    }
  }

  unsubscribe(query: BaseQuery) {
    const queryInfo = this.activeQueries.get(query)
    if (queryInfo) {
      this.activeQueries.delete(query)
      if (queryInfo.cacheKey) {
        this.cache.changeTracker.untrack(queryInfo.cacheKey)
      }
    }
  }

  storeQueryData(query: BaseQuery, data: any) {
    const { newCacheKey, affectedCacheKeys } = this.cache.saveQueryData(
      query,
      data
    )
    if (newCacheKey) {
      this.cache.changeTracker.track(newCacheKey)

      // set cacheKey for those active queries that are pending for data fetching
      for (const [q, qInfo] of this.activeQueries) {
        if (!qInfo.cacheKey && newCacheKey.matches(q)) {
          qInfo.cacheKey = newCacheKey
        }
      }
    }

    this.new_notifyActiveQueries(affectedCacheKeys)
  }

  mergeQueryData<TResult, TArguments, TContext>(
    query: CompoundQuery<TResult, TArguments, TContext>,
    newData: any,
    mergeFn: (existingData: any, newData: any) => any
  ) {
    const cacheKey = this.activeQueries.get(query)?.cacheKey
    if (!cacheKey) {
      throw new Error(`[Kho] Unable to find cache key to merge data.`)
    }

    const { shape } = query.original.options
    this.cache.saveMoreQueryData(cacheKey, newData, shape, mergeFn)
    this.notifyActiveQueries()
  }

  retrieveQueryData(query: BaseQuery) {
    const cacheKey = this.cache.findCacheKey(query)
    return cacheKey ? this.cache.get(cacheKey) : undefined
  }

  storeMutationResult<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    data: TResult,
    optimistic: boolean = false
  ) {
    const { shape, beforeQueryUpdates } = mutation.options

    const normalizedData =
      data && shape ? this.cache.saveMutationResult(data, shape) : null

    const info = {
      mutationResult: normalizedData ?? data,
      mutationArgs: mutation.options.arguments!,
      optimistic,
    }

    if (beforeQueryUpdates) {
      beforeQueryUpdates(this.cache, info)
    }
    this.cache.updateRelatedQueries(mutation, info)

    this.notifyActiveQueries()
  }

  purgeInactiveQueries(
    queries: Array<Query<any, any, any> | CompoundQuery<any, any, any>>
  ) {
    const inactiveCacheKeys: CacheKey[] = []
    // prettier-ignore
    const queriesToRefetch: Array<Query<any, any, any> | CompoundQuery<any, any, any>> = []

    queries.forEach((query) => {
      if (query instanceof CompoundQuery) {
        const q = this.findActiveQuery(query)
        if (q) {
          queriesToRefetch.push(
            q as Query<any, any, any> | CompoundQuery<any, any, any>
          )
        } else {
          const cacheKey = this.cache.findCacheKey(query)
          if (cacheKey) {
            inactiveCacheKeys.push(cacheKey)
          }
        }
      } else {
        // query may be specified with partial or no arguments
        // so we need to find all the matching queries currently in cache
        const siblingQueriesInCache = this.cache.findSiblingQueries(query)
        for (const [sibling, cacheKey] of siblingQueriesInCache) {
          const q = this.findActiveQuery(sibling)
          if (q) {
            queriesToRefetch.push(
              q as Query<any, any, any> | CompoundQuery<any, any, any>
            )
          } else {
            inactiveCacheKeys.push(cacheKey)
          }
        }
      }
    })

    this.cache.removeQueries(inactiveCacheKeys)
    return queriesToRefetch
  }

  /** resets cache then refetches active queries */
  reset(
    // prettier-ignore
    cb: (queries: Array<Query<any, any, any> | CompoundQuery<any, any, any>>) => void
  ) {
    this.cache.clear()

    // prettier-ignore
    const queriesToRefetch: Array<Query<any, any, any> | CompoundQuery<any, any, any>> = []
    for (const [q, qInfo] of this.activeQueries) {
      if (q instanceof LocalQuery) {
        // prettier-ignore
        qInfo.cacheKey = this.cache.saveQueryData(q, q.options.initialValue ?? null).newCacheKey!
      } else if (q instanceof Query || q instanceof CompoundQuery) {
        qInfo.cacheKey = undefined
        queriesToRefetch.push(q)
      }
    }

    cb(queriesToRefetch)
    this.notifyActiveQueries()
  }

  //========== Private methods =============

  // notify active queries of possible state change
  private notifyActiveQueries() {
    for (const [q, qInfo] of this.activeQueries) {
      if (qInfo.cacheKey) {
        qInfo.onData(this.cache.get(qInfo.cacheKey))
      }
    }
  }

  // notify active queries of possible state change
  private new_notifyActiveQueries(cacheKeys: Set<CacheKey>) {
    for (const [q, qInfo] of this.activeQueries) {
      if (qInfo.cacheKey && cacheKeys.has(qInfo.cacheKey)) {
        qInfo.onData(this.cache.get(qInfo.cacheKey))
      }
    }
  }

  private findActiveQuery(query: BaseQuery) {
    for (const q of this.activeQueries.keys()) {
      if (q.key.matches(query.key)) {
        return q
      }
    }
    return null
  }
}

export default CacheController

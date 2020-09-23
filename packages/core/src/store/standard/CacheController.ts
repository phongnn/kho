import CacheContainer, { CacheKey } from "../../cache/CacheContainer"
import { BaseQuery } from "../../common/BaseQuery"
import { Query } from "../../common/Query"
import { LocalQuery } from "../../common/LocalQuery"
import CompoundQuery from "../../common/CompoundQuery"
import { Mutation } from "../../common/Mutation"

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
      const existingData = this.cache.get(cacheKey)
      setTimeout(() => onData(existingData)) // callback right after subscription
      return true
    } else if (query instanceof LocalQuery) {
      const { initialValue = null } = query.options
      const newCacheKey = this.cache.saveQueryData(query, initialValue)
      this.activeQueries.set(query, { onData, cacheKey: newCacheKey! })
      if (initialValue) {
        setTimeout(() => onData(initialValue))
      }
      return true
    } else {
      this.activeQueries.set(query, { onData })
      return false
    }
  }

  unsubscribe(query: BaseQuery) {
    this.activeQueries.delete(query)
  }

  findActiveQuery(query: BaseQuery) {
    for (const q of this.activeQueries.keys()) {
      if (q.key.matches(query.key)) {
        return q
      }
    }
    return null
  }

  storeQueryData(query: BaseQuery, data: any) {
    const newCacheKey = this.cache.saveQueryData(query, data)
    if (newCacheKey) {
      // set cacheKey for those active queries that are pending for data fetching
      for (const [q, qInfo] of this.activeQueries) {
        if (!qInfo.cacheKey && newCacheKey.matches(q)) {
          qInfo.cacheKey = newCacheKey
        }
      }
    }

    this.notifyActiveQueries()
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
    this.cache.saveAdditionalQueryData(cacheKey, newData, shape, mergeFn)
    this.notifyActiveQueries()
  }

  retrieveQueryData(query: BaseQuery) {
    const cacheKey = this.cache.findCacheKey(query)
    return cacheKey ? this.cache.get(cacheKey) : undefined
  }

  storeMutationResult<TResult, TArguments, TContext>(
    mutation: Mutation<TResult, TArguments, TContext>,
    data: any,
    optimistic: boolean = false
  ) {
    const { shape, beforeQueryUpdates } = mutation.options

    const normalizedData =
      data && shape ? this.cache.saveMutationResult(data, shape) : null

    const info = {
      mutationResult: normalizedData ?? data,
      mutationArgs: mutation.options.arguments,
      optimistic,
    }
    const queryUpdateContext = beforeQueryUpdates
      ? beforeQueryUpdates(this.cache, info)
      : undefined

    const infoWithContext = { ...info, context: queryUpdateContext }
    this.cache.updateRelatedQueries(mutation, infoWithContext)

    this.notifyActiveQueries()

    return infoWithContext // for afterQueryUpdates() processing
  }

  removeInactiveQueries(inactiveQueries: BaseQuery[]) {
    inactiveQueries.forEach((q) => this.cache.removeQueryData(q))
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
        qInfo.cacheKey = this.cache.saveQueryData(q, q.options.initialValue ?? null)!
      } else if (q instanceof Query || q instanceof CompoundQuery) {
        qInfo.cacheKey = undefined
        queriesToRefetch.push(q)
      }
    }

    cb(queriesToRefetch)
    this.notifyActiveQueries()
  }

  // notify active queries of possible state change
  private notifyActiveQueries() {
    for (const [q, qInfo] of this.activeQueries) {
      if (qInfo.cacheKey) {
        qInfo.onData(this.cache.get(qInfo.cacheKey))
      }
    }
  }
}

export default CacheController

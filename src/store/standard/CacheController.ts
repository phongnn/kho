// prettier-ignore
import { BaseQuery, Query, LocalQuery, CompoundQuery, Mutation, LocalMutation } from "../../common"
import { CacheContainer, CacheKey } from "../../cache"
import { mergeSets } from "../../common/helpers"
import CacheProxyImpl from "./CacheProxyImpl"

interface ActiveQueryInfo {
  readonly onData: (data: any) => void
  cacheKey?: CacheKey
}

class CacheController {
  private activeQueries: Map<BaseQuery, ActiveQueryInfo>
  private cache: CacheContainer

  constructor(preloadedState?: any) {
    this.cache = new CacheContainer(
      preloadedState ? preloadedState.cache : undefined
    )
    this.activeQueries = new Map<BaseQuery, ActiveQueryInfo>()
  }

  getState() {
    return {
      // activeQueries: [], // TODO: implement this
      cache: this.cache.getState(),
    }
  }

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
      // prettier-ignore
      const { newCacheKey, affectedCacheKeys } = this.cache.saveQueryData(query, initialValue)
      this.activeQueries.set(query, { onData, cacheKey: newCacheKey! })
      this.cache.changeTracker.track(newCacheKey!)

      if (initialValue) {
        // setTimeout(() => onData(initialValue))
        setTimeout(() => this.notifyActiveQueries(affectedCacheKeys))
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

  retrieveQueryData(query: BaseQuery) {
    const cacheKey = this.cache.findCacheKey(query)
    return cacheKey ? this.cache.get(cacheKey) : undefined
  }

  storeQueryData(query: BaseQuery, data: any) {
    // prettier-ignore
    const { newCacheKey, affectedCacheKeys: cacheKeys_1, normalizedData } = this.cache.saveQueryData(query, data)
    if (newCacheKey) {
      this.cache.changeTracker.track(newCacheKey)

      // set cacheKey for those active queries that are pending for data fetching
      for (const [q, qInfo] of this.activeQueries) {
        if (!qInfo.cacheKey && newCacheKey.matches(q)) {
          qInfo.cacheKey = newCacheKey
        }
      }
    }

    const cacheKeys_2 = this.cache.updateRelatedQueries(query, normalizedData)
    const affectedCacheKeys = mergeSets(cacheKeys_1, cacheKeys_2)

    this.notifyActiveQueries(affectedCacheKeys)
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
    // prettier-ignore
    const { affectedCacheKeys: cacheKeys_1, normalizedData } = this.cache.saveMoreQueryData(cacheKey, newData, shape, mergeFn)

    const cacheKeys_2 = this.cache.updateRelatedQueries(query, normalizedData)
    const affectedCacheKeys = mergeSets(cacheKeys_1, cacheKeys_2)

    this.notifyActiveQueries(affectedCacheKeys)
  }

  storeMutationData<TData>(
    mutation: Mutation<TData, any, any> | LocalMutation<TData>,
    data: TData,
    optimistic: boolean = false
  ) {
    let normalizedData: any = null
    let cacheKeys_1 = new Set<CacheKey>()

    // prettier-ignore
    const shape = mutation instanceof LocalMutation ? mutation.options.inputShape : mutation.options.resultShape
    if (data && shape) {
      const tmp = this.cache.saveMutationResult(data, shape)
      normalizedData = tmp.normalizedData
      cacheKeys_1 = tmp.affectedCacheKeys
    }

    const info =
      mutation instanceof LocalMutation
        ? { mutationInput: normalizedData ?? data }
        : {
            mutationResult: normalizedData ?? data,
            mutationArgs: mutation.options.arguments!,
            optimistic,
          }

    let cacheKeys_2 = new Set<CacheKey>()
    const { beforeQueryUpdates } = mutation.options
    if (beforeQueryUpdates) {
      const cacheProxy = new CacheProxyImpl(this.cache)
      // @ts-ignore
      beforeQueryUpdates(cacheProxy, info)
      // prettier-ignore
      cacheKeys_2 = this.cache.changeTracker.findAffectedCacheKeys(cacheProxy.changedObjectKeys)
    }

    // prettier-ignore
    const cacheKeys_3 = this.cache.updateQueriesRelatedToMutation(mutation, info)
    const affectedCacheKeys = mergeSets(cacheKeys_1, cacheKeys_2, cacheKeys_3)

    this.notifyActiveQueries(affectedCacheKeys)
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
        const cachedQueries = this.cache.findCachedQueryArgs(query)
        for (const [cacheKey, args] of cachedQueries) {
          const q = this.findActiveQuery(query.withOptions({ arguments: args }))
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
    const cacheKeysToNotify = new Set<CacheKey>()
    for (const [q, qInfo] of this.activeQueries) {
      if (q instanceof LocalQuery) {
        // prettier-ignore
        qInfo.cacheKey = this.cache.saveQueryData(q, q.options.initialValue ?? null).newCacheKey!
        cacheKeysToNotify.add(qInfo.cacheKey)
      } else if (q instanceof Query || q instanceof CompoundQuery) {
        qInfo.cacheKey = undefined
        queriesToRefetch.push(q)
      }
    }

    cb(queriesToRefetch)
    this.notifyActiveQueries(cacheKeysToNotify)
  }

  getActiveNonLocalQueries() {
    const result = []
    for (let q of this.activeQueries.keys()) {
      if (q instanceof Query || q instanceof CompoundQuery) {
        result.push(q)
      }
    }
    return result
  }

  //========== Private methods =============

  // notify active queries of possible state change
  private notifyActiveQueries(cacheKeys: Set<CacheKey>) {
    if (cacheKeys.size > 0) {
      for (const [q, qInfo] of this.activeQueries) {
        if (qInfo.cacheKey && cacheKeys.has(qInfo.cacheKey)) {
          qInfo.onData(this.cache.get(qInfo.cacheKey))
        }
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

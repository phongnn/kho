import { Store, StoreOptions } from "../common"
import AdvancedStoreImpl from "./standard/AdvancedStoreImpl"

export function createStore(options?: StoreOptions): Store {
  const {
    queryExpiryMs = 15 * 60 * 1000, // 15 minutes
    ...rest
  } = options || {}

  return new AdvancedStoreImpl({ queryExpiryMs, ...rest })
}

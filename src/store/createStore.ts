import { Store } from "../common"
import AdvancedStoreImpl from "./standard/AdvancedStoreImpl"

export function createStore(options: { queryExpiryMs?: number } = {}): Store {
  const {
    queryExpiryMs = 15 * 60 * 1000, // 15 minutes
  } = options

  return new AdvancedStoreImpl({ queryExpiryMs })
}

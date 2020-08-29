import { Store, StoreOptions } from "./Store"
import StandardStore from "./standard-store/StandardStore"

export function createStore(options?: StoreOptions): Store {
  return new StandardStore()
}

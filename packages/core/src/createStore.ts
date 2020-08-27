import { Store, StoreOptions } from "./Store"
import StandardStore from "./StandardStore"

export function createStore(options?: StoreOptions): Store {
  return new StandardStore()
}

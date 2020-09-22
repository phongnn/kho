import { Store } from "./Store"
import StandardStore from "./standard/StandardStore"

export function createStore(): Store {
  return new StandardStore()
}

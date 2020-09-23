import { Store } from "../common"
import AdvancedStoreImpl from "./standard/AdvancedStoreImpl"

export function createStore(): Store {
  return new AdvancedStoreImpl()
}

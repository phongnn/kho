import React, { ReactElement, useContext } from "react"
import { Store, AdvancedStore } from "@fnc/core"

const StoreContext = React.createContext<Store | null>(null)

export function Provider(props: { store: Store; children: ReactElement }) {
  const { store, children } = props
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useAdvancedStore() {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error(
      "Data store not found. Make sure you have a Provider component in the tree."
    )
  }
  return store as AdvancedStore
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error(
      "Data store not found. Make sure you have a Provider component in the tree."
    )
  }
  return store
}

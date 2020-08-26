import React, { ReactElement } from "react"
import { Store, InternalStore } from "@fnc/core"

const FNCContext = React.createContext<InternalStore | null>(null)

export function Provider(props: { store: Store; children: ReactElement }) {
  const { store, children } = props
  return (
    <FNCContext.Provider value={store as InternalStore}>
      {children}
    </FNCContext.Provider>
  )
}

export const useStore = () => {
  const store = React.useContext(FNCContext)
  if (!store) {
    throw new Error(
      "FNC store not found. Make sure you have a Provider component in the tree."
    )
  }
  return store
}

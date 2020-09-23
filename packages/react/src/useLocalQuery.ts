import { useEffect, useState } from "react"
import { LocalQuery } from "@fnc/core"

import { useAdvancedStore } from "./Provider"

export function useLocalQuery<TResult>(query: LocalQuery<TResult>) {
  const store = useAdvancedStore()
  const [data, setData] = useState<TResult | null>(null)

  useEffect(() => {
    const { unregister } = store.registerLocalQuery(query, {
      onData: setData,
    })

    return unregister
  }, [store, query])

  return { data }
}

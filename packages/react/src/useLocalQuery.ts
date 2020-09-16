import { useEffect, useState } from "react"
import { LocalQuery } from "@fnc/core"

import { useInternalStore } from "./Provider"

export function useLocalQuery<TResult>(query: LocalQuery<TResult>) {
  const store = useInternalStore()
  const [data, setData] = useState<TResult | null>(null)

  useEffect(() => {
    const { unregister } = store.registerLocalQuery(query, {
      onData: setData,
    })

    return unregister
  }, [store, query])

  return { data }
}

import { useEffect, useState } from "react"
import { LocalQuery } from "@fnc/core"

import { useStore } from "./Provider"

export function useLocalQuery<TResult>(query: LocalQuery<TResult>) {
  const store = useStore()
  const [data, setData] = useState(null)

  useEffect(() => {
    const { unregister } = store.registerLocalQuery(query, {
      onData: setData,
    })

    return unregister
  }, [store, query])

  return { data: data as TResult | null }
}

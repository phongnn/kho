import React from "react"
import { equal } from "@wry/equality"

export { equal } from "@wry/equality"

/**
 * useEffect but using deep comparison not reference equality of the inputs
 * (copied from https://github.com/kentcdodds/use-deep-compare-effect)
 */
export function useDeepCompareEffect(
  effect: React.EffectCallback,
  dependencies: React.DependencyList
) {
  const ref = React.useRef<React.DependencyList>([])
  if (!equal(dependencies, ref.current)) {
    ref.current = dependencies
  }

  React.useEffect(effect, ref.current)
}

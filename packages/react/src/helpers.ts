export function deepEqual(a: any, b: any) {
  if (a === b || (!a && !b)) {
    return true
  } else if (!a || !b) {
    return false
  }

  const type = a.toString()
  if (type !== b.toString()) {
    return false
  }

  const keys = Object.keys(a)
  const keyCount = keys.length
  if (keyCount !== Object.keys(b).length) {
    return false
  }

  for (let i = 0; i < keyCount; ++i) {
    if (!b.hasOwnProperty(keys[i])) {
      return false
    }
  }

  for (let i = 0; i < keyCount; ++i) {
    const key = keys[i]
    if (!deepEqual(a[key], b[key])) {
      return false
    }
  }

  return true
}

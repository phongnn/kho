export function equal(a: any, b: any) {
  if (a === b || (!a && !b)) {
    return true
  } else if (!a || !b) {
    return false
  }

  const aKeys = Object.keys(a)
  const keyCount = aKeys.length
  if (keyCount !== Object.keys(b).length) {
    return false
  }

  for (let i = 0; i < keyCount; ++i) {
    if (!b.hasOwnProperty(aKeys[i])) {
      return false
    }
  }

  for (let i = 0; i < keyCount; ++i) {
    const key = aKeys[i]
    if (!equal(a[key], b[key])) {
      return false
    }
  }

  return true
}

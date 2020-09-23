import { Query } from "./Query"
import CompoundQuery from "./CompoundQuery"
import { NormalizedType } from "./NormalizedType"

export const env = process.env.NODE_ENV
export const isProduction = env === "production"

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

/** converts to CompoundQuery if necessary */
export function getActualQuery(query: Query<any, any, any>) {
  return !query.options.merge ? query : new CompoundQuery(query)
}

export function extractPlainKey(obj: any, type: NormalizedType) {
  const { keyFields } = type
  const keyObj: any = {}

  keyFields.forEach((f) => {
    if (!obj[f]) {
      throw new Error(
        `[Kho] Data of type "${type.name}" must contain key field "${f}".`
      )
    }
    keyObj[f] = obj[f]
  })

  // return primitive key (if possible) for faster comparison
  return keyFields.length === 1 ? obj[keyFields[0]] : keyObj
}

export function mergeOptions(opts: any, newOpts: any) {
  const { context = {}, ...otherOpts } = opts
  const { context: additionalContext = {}, ...overridingOpts } = newOpts
  const result = override(otherOpts, overridingOpts)
  result.context = { ...context, ...additionalContext }
  return result
}

function override(existingObj: any, newObj: any) {
  const result: any = {}
  Object.getOwnPropertyNames(existingObj).forEach(
    (prop) => (result[prop] = newObj[prop] || existingObj[prop])
  )
  Object.getOwnPropertyNames(newObj).forEach(
    (prop) => (result[prop] = newObj[prop] || existingObj[prop])
  )
  return result
}

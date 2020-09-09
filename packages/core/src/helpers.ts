import { NormalizedType } from "./normalization/NormalizedType"

export { equal as deepEqual } from "@wry/equality"

export const env = process.env.NODE_ENV
export const isProduction = env === "production"

/**
 * A non-compliant but very performant implementation to generate GUID-like identifiers
 * (by @joelpt: https://stackoverflow.com/a/13403498)
 */
// export function guid() {
//   return (
//     Math.random().toString(36).substring(2, 15) +
//     Math.random().toString(36).substring(2, 15)
//   )
// }

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

export function extractPlainKey(obj: any, type: NormalizedType) {
  const { keyFields } = type
  const keyObj: any = {}

  keyFields.forEach((f) => {
    if (!obj[f]) {
      throw new Error(
        `[FNC] Data of type "${type.name}" must contain key field "${f}".`
      )
    }
    keyObj[f] = obj[f]
  })

  // return primitive key (if possible) for faster comparison
  return keyFields.length === 1 ? obj[keyFields[0]] : keyObj
}

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

export function override(existingObj: any, newObj: any) {
  const result: any = {}
  Object.getOwnPropertyNames(existingObj).forEach(
    (prop) => (result[prop] = newObj[prop] || existingObj[prop])
  )
  Object.getOwnPropertyNames(newObj).forEach(
    (prop) => (result[prop] = newObj[prop] || existingObj[prop])
  )
  return result
}

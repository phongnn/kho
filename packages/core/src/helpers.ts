export { equal as deepEqual } from "@wry/equality"

/**
 * A non-compliant but very performant implementation to generate GUID-like identifiers
 * (by @joelpt: https://stackoverflow.com/a/13403498)
 */
export function guid() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  )
}

export const env = process.env.NODE_ENV
export const isProduction = env === "production"

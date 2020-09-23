import { mergeOptions, deepEqual } from "./helpers"

// prettier-ignore
test("deepEqual() should work", () => {
  expect(deepEqual({ a: [1, 2] }, { a: [1, 2] })).toBe(true)
  expect(deepEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false)

  expect(deepEqual({ a: [1, { b: 1 }] }, { a: [1, { b: 1 }] })).toBe(true)
  expect(deepEqual({ a: [1, { b: 1 }] }, { a: [1, { b: 2 }] })).toBe(false)

  expect(deepEqual({ a: [1, { b: ["x", "y"] }] }, { a: [1, { b: ["x", "y"] }] })).toBe(true)
  expect(deepEqual({ a: [1, { b: ["x", "y"] }] }, { a: [1, { b: ["x", "y", "z"] }] })).toBe(false)
  expect(deepEqual({ a: [1, { b: ["x", "y"] }] }, { a: [1, { b: ["x", "z"] }] })).toBe(false)

  expect(deepEqual({ a: [1, { b: [{ x: "y" }] }] }, { a: [1, { b: [{ x: "y" }] }] })).toBe(true)
  expect(deepEqual({ a: [1, { b: [{ x: "y" }] }] }, { a: [1, { b: [{ x: "z" }] }] })).toBe(false)
  expect(deepEqual({ a: [1, { b: [{ x: "y" }] }] }, { a: [1, { b: [{ x: "y", z: "z" }] }] })).toBe(false)
})

describe("mergeOptions()", () => {
  const originalOptions = {
    fetchPolicy: "cache-and-network",
    arguments: { name: "Nguyen", age: 20 },
    context: {
      token: "xyz",
      cors: "*",
      extra: {
        blah: true,
      },
    },
  }

  it("should override arguments only", () => {
    const args = { name: "Tran", age: 19 }
    const result = mergeOptions(originalOptions, { arguments: args })
    expect(result).toStrictEqual({
      ...originalOptions,
      arguments: args,
    })
  })

  it("should shallow merge context", () => {
    const result = mergeOptions(originalOptions, {
      context: {
        token: "aaa",
        extra: {
          something: "good",
        },
      },
    })

    expect(result).toStrictEqual({
      ...originalOptions,
      context: {
        token: "aaa",
        cors: "*",
        extra: {
          something: "good",
        },
      },
    })
  })

  it("should not override with undefined values", () => {
    const result = mergeOptions(originalOptions, {
      arguments: undefined,
      context: undefined,
    })
    expect(result).toStrictEqual(originalOptions)
  })
})

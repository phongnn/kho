import { mergeOptions } from "./helpers"

describe("mergeOptions", () => {
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

import { Query } from "./Query"

const originalQuery = new Query(
  "GetX",
  (
    args: { name: string; age: number },
    ctx: { token: string; cors: string; extra?: any }
  ) => Promise.resolve(`${args.name} (${args.age})`),
  {
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
)

describe("withOptions", () => {
  it("should override arguments only", () => {
    const args = { name: "Tran", age: 19 }
    const query = originalQuery.withOptions({ arguments: args })
    expect(query.options).toStrictEqual({
      ...originalQuery.options,
      arguments: args,
    })
  })

  it("should shallow merge context", () => {
    const query = originalQuery.withOptions({
      context: {
        token: "aaa",
        extra: {
          something: "good",
        },
      },
    })

    expect(query.options).toStrictEqual({
      ...originalQuery.options,
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
    const query = originalQuery.withOptions({
      arguments: undefined,
      context: undefined,
    })
    expect(query.options).toStrictEqual(originalQuery.options)
  })
})

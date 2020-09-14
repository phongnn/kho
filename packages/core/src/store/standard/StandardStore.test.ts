import { Query } from "../../query/Query"
import { LocalQuery } from "../../query/LocalQuery"
import StandardStore from "./StandardStore"
import { Mutation } from "../../query/Mutation"

afterEach(() => {
  // @ts-ignore
  Query.registry = new Map()
})

describe("LocalQuery", () => {
  it("should callback with initial value, then with set data", (done) => {
    const initialValue = { msg: null }
    const testPayload = { msg: "Hello, World" }
    const query = new LocalQuery("SomeLocalState", { initialValue })
    const mutation = new Mutation(() => Promise.resolve(), {
      update: (cache) => cache.updateQuery(query, testPayload),
    })
    const store = new StandardStore()
    store.registerLocalQuery(query, {
      onData: (data) => {
        if (data === initialValue) {
          setTimeout(() => store.processMutation(mutation))
        } else {
          expect(data).toBe(testPayload)
          done()
        }
      },
    })
  })
})

describe("resetStore()", () => {
  it("should reset cache and refetch active query", (done) => {
    let count = 0
    const query = new Query("GetData", () => Promise.resolve(++count))
    const store = new StandardStore()
    store.registerQuery(query, {
      onData: (data) => {
        if (data === 1) {
          setTimeout(() => store.resetStore())
        } else {
          expect(data).toBe(2)
          done()
        }
      },
    })
  })

  it("should reset active local query's value", (done) => {
    const query = new LocalQuery("Profile", { initialValue: "nothing" })
    const mutation = new Mutation(() => Promise.resolve(), {
      update: (cache) => cache.updateQuery(query, "something"),
    })

    const store = new StandardStore()
    let valueSet = false
    store.registerLocalQuery(query, {
      onData: (data) => {
        if (data === "nothing" && !valueSet) {
          valueSet = true
          setTimeout(() => store.processMutation(mutation))
        } else if (data === "something") {
          setTimeout(() => store.resetStore())
        } else {
          expect(data).toBe("nothing") // reset to initial value
          done()
        }
      },
    })
  })
})

describe("query()", () => {
  it("should load and return data", async () => {
    const query = new Query("GetData", jest.fn().mockResolvedValue("hello"))
    const store = new StandardStore()
    const result = await store.query(query)
    expect(result).toBe("hello")
  })

  it("should load and return error", async () => {
    // prettier-ignore
    const query = new Query("GetData", jest.fn().mockRejectedValue("strange error"))
    const store = new StandardStore()

    jest.spyOn(console, "error").mockImplementation(() => {})
    expect.assertions(1)
    try {
      await store.query(query)
    } catch (e) {
      expect(e.message).toMatch("strange error")
    }
  })

  it("should return cached data", (done) => {
    let count = 0
    const query = new Query(
      "GetData",
      () => new Promise((r) => setTimeout(() => r(++count)))
    )
    const store = new StandardStore()

    store.registerQuery(query, {
      onData: () => {
        setTimeout(async () => {
          const result = await store.query(query)
          expect(result).toBe(1) // cached value
          done()
        })
      },
    })
  })

  it("should bypass cache for network-only query", (done) => {
    let count = 0
    const query = new Query(
      "GetData",
      () => new Promise((r) => setTimeout(() => r(++count)))
    )
    const store = new StandardStore()

    const { unregister } = store.registerQuery(query, {
      onData: () => {
        setTimeout(async () => {
          unregister() // clean up to prevent this test case from interfering with the subsequent ones

          // prettier-ignore
          const result = await store.query(query, { fetchPolicy: "network-only" })
          expect(result).toBe(2) // latest value, not the one cached
          done()
        })
      },
    })
  })

  it("should work with compound query", (done) => {
    let count = 0
    const query = new Query(
      "GetX",
      () => new Promise((r) => setTimeout(() => r(++count))),
      { merge: (e, n) => e + n }
    )
    const store = new StandardStore()

    store.registerQuery(query, {
      onData: () => {
        setTimeout(async () => {
          const result = await store.query(query)
          expect(result).toBe(1) // cached value
          done()
        })
      },
    })
  })

  it("prefetching should work as well", (done) => {
    let count = 0
    const query = new Query(
      "GetY",
      () => new Promise((r) => setTimeout(() => r(++count))),
      { merge: (e, n) => e + n }
    )
    const store = new StandardStore()

    store.query(query).then(() => {
      store.registerQuery(query, {
        onData: (data) => {
          expect(data).toBe(1) // cached value
          done()
        },
      })
    })
  })
})

import StandardStore from "./StandardStore"
import { Query } from "../../query/Query"
import { Mutation } from "../../query/Mutation"
import { NormalizedType } from "../../normalization/NormalizedType"

afterEach(() => {
  // @ts-ignore
  Query.registry = new Map()
  // @ts-ignore
  NormalizedType.typeRegistry = new Map()
})

describe("callbacks", () => {
  it("should execute mutate function and invoke callbacks", (done) => {
    const result = { value: { x: "y" } }
    const fn = jest.fn().mockResolvedValue(result)

    const args = { test: { message: "blah" } }
    const context = { token: "xyz", extra: { test: true } }
    const mutation = new Mutation(fn, { arguments: args, context })

    const onRequest = jest.fn()

    const store = new StandardStore()
    store.processMutation(mutation, {
      onRequest,
      onComplete: (data) => {
        expect(onRequest).toBeCalled()
        expect(fn).toBeCalledWith(args, context)
        expect(data).toBe(result)
        done()
      },
    })
  })

  it("should invoke error callback", (done) => {
    const errMsg = "a strang error"
    const fn = jest.fn().mockRejectedValue(errMsg)
    const mutation = new Mutation(fn)

    jest.spyOn(console, "error").mockImplementation(() => {})
    const store = new StandardStore()
    store.processMutation(mutation, {
      onComplete: () => {
        throw new Error("It should not have invoked onComplete callback.")
      },
      onError: (err) => {
        expect(err.message).toMatch(errMsg)
        done()
      },
    })
  })

  it("should update cache and notify active query", (done) => {
    // prettier-ignore
    const UserType = NormalizedType.register("User", { keyFields: ["username"] })
    const query = new Query(
      "GetUsers",
      () =>
        Promise.resolve([
          { username: "x", email: "x@test.com" },
          { username: "y", email: "y@test.com", avatar: "http://" },
        ]),
      { shape: [UserType] }
    )

    const store = new StandardStore()
    store.registerQuery(query, {
      onData: (data) => {
        const y = data.find((u) => u.username === "y")
        if (y?.email === "new-y@test.com") {
          expect(y).toStrictEqual({
            username: "y",
            email: "new-y@test.com",
            avatar: "http://",
          })
          done()
        }
      },
    })

    const mutation = new Mutation(
      () =>
        Promise.resolve([
          { username: "z", email: "z@test.com" },
          { username: "y", email: "new-y@test.com" },
        ]),
      { shape: [UserType] }
    )
    store.processMutation(mutation)
  })
})

describe("update()", () => {
  it("should update query result", (done) => {
    // prettier-ignore
    const UserType = NormalizedType.register("User", { keyFields: ["username"] })
    const query = new Query(
      "GetUsers",
      () =>
        Promise.resolve([
          { username: "x", email: "x@test.com" },
          { username: "y", email: "y@test.com", avatar: "http://" },
        ]),
      { shape: [UserType] }
    )

    const store = new StandardStore()
    store.registerQuery(query, {
      onData: (data) => {
        if (data.length === 3) {
          expect(data[2]).toStrictEqual({ username: "z", email: "z@test.com" })
          done()
        }
      },
    })

    const mutation = new Mutation(
      () => Promise.resolve({ username: "z", email: "z@test.com" }),
      {
        shape: UserType,
        update: (cache, { data }) => {
          cache.updateQueryResult(query, (existingData = []) => [
            ...existingData,
            data,
          ])
        },
      }
    )
    store.processMutation(mutation)
  })

  it("should evict normalized object", (done) => {
    // prettier-ignore
    const UserType = NormalizedType.register("User", { keyFields: ["username"] })
    const query = new Query(
      "GetUsers",
      () =>
        Promise.resolve([
          { username: "x", email: "x@test.com" },
          { username: "y", email: "y@test.com", avatar: "http://" },
        ]),
      { shape: [UserType] }
    )

    const store = new StandardStore()
    store.registerQuery(query, {
      onData: (data) => {
        if (data.length === 1) {
          expect(data[0].username).toBe("y")
          done()
        }
      },
    })

    const mutation = new Mutation(() => Promise.resolve(), {
      update: (cache) => cache.evictObject(UserType, { username: "x" }),
    })
    store.processMutation(mutation)
  })
})

describe("optimistic response", () => {
  it("should callback with an optimistic response, then with the real one", (done) => {
    // prettier-ignore
    const UserType = NormalizedType.register("User", { keyFields: ["username"] })
    const query = new Query(
      "GetUsers",
      () =>
        Promise.resolve([
          { username: "x", email: "x@test.com", __optimistic__: false },
          // prettier-ignore
          { username: "y", email: "y@test.com", avatar: "http://", __optimistic__: false },
        ]),
      { shape: [UserType] }
    )

    expect.assertions(2)

    const store = new StandardStore()
    store.registerQuery(query, {
      onData: (data) => {
        if (data.length > 2) {
          const newUser = data[2]
          expect(newUser.username).toBe("z")
          if (!newUser.__optimistic__) {
            done()
          }
        }
      },
    })

    const mutation = new Mutation(
      () =>
        new Promise((r) =>
          setTimeout(() =>
            r({
              username: "z",
              email: "z@test.com",
              __optimistic__: false,
            })
          )
        ),
      {
        shape: UserType,
        update: (cache, { data, optimistic }) => {
          // update() is called twice, but we should add to list only once
          if (optimistic) {
            cache.updateQueryResult(query, (existingData = []) => [
              ...existingData,
              data,
            ])
          }
        },
        optimisticResponse: {
          username: "z",
          email: "z@test.com",
          __optimistic__: true,
        },
      }
    )
    store.processMutation(mutation)
  })
})

describe("refetchQueries", () => {
  it("should work", (done) => {
    let count = 0
    // prettier-ignore
    const query = new Query("GetData", (args: { name: string }) => Promise.resolve(++count))
    const q1 = query.withOptions({ arguments: { name: "x" } })
    const q2 = query.withOptions({ arguments: { name: "y" } })

    const mutation = new Mutation(jest.fn().mockResolvedValue(null), {
      refetchQueries: [query.withOptions({ arguments: { name: "x" } })],
    })

    const store = new StandardStore()
    store.registerQuery(q1, {
      onData: (countValue) => {
        if (countValue > 2) {
          expect(countValue).toBe(3)
          done()
        }
      },
    })
    store.registerQuery(q2, {
      onData: (countValue) => {
        if (countValue > 2) {
          throw new Error("Query is unexpectedly refetched.")
        }
      },
    })

    store.processMutation(mutation)
  })

  it("should work in sync mode", (done) => {
    let count = 0
    const query = new Query("GetData", () => Promise.resolve(++count))
    const mutation = new Mutation(jest.fn().mockResolvedValue(null), {
      refetchQueriesSync: [query],
    })

    const store = new StandardStore()
    store.registerQuery(query, { onData: jest.fn() })

    store.processMutation(mutation, {
      onComplete: () => {
        expect(count).toBe(2) // query already refetched
        done()
      },
    })
  })

  it("should refetch active compound query", (done) => {
    let count = 0
    const query = new Query(
      "GetData",
      (args: { x: number }) => Promise.resolve([`${args.x}-${++count}`]),
      {
        merge: (existingData, newData) => [...existingData, ...newData],
      }
    )
    const mutation = new Mutation(jest.fn().mockResolvedValue(null), {
      refetchQueries: [query],
    })

    let mutationProcessed = false
    const store = new StandardStore()
    const { fetchMore } = store.registerQuery(
      query.withOptions({ arguments: { x: 1 } }),
      {
        onData: (data) => {
          if (data.length === 1) {
            setTimeout(() =>
              fetchMore(query.withOptions({ arguments: { x: 2 } }))
            )
          } else if (!mutationProcessed) {
            mutationProcessed = true
            store.processMutation(mutation)
          } else {
            expect(data).toStrictEqual(["1-3", "2-4"]) // refetched values
            done()
          }
        },
      }
    )
  })

  it("should remove inactive queries' data", (done) => {
    let count = 0
    const query = new Query("GetData", () => Promise.resolve(++count))
    const mutation = new Mutation(jest.fn().mockResolvedValue(null), {
      refetchQueries: [query],
    })

    const store = new StandardStore()
    const { unregister } = store.registerQuery(query, {
      onData: () =>
        setTimeout(() => {
          unregister() // make the query inactive
          store.processMutation(mutation, {
            onComplete: () =>
              store.registerQuery(query, {
                onData: (data) => {
                  // refetched value as previous value was already removed from cache
                  expect(data).toBe(2)
                  done()
                },
              }),
          })
        }),
    })
  })

  /** same code as async case but uses "refetchQueriesSync" instead of "refetchQueries" */
  it("should refetch active compound query [sync mode]", (done) => {
    let count = 0
    const query = new Query(
      "GetData",
      (args: { x: number }) => Promise.resolve([`${args.x}-${++count}`]),
      {
        merge: (existingData, newData) => [...existingData, ...newData],
      }
    )
    const mutation = new Mutation(jest.fn().mockResolvedValue(null), {
      refetchQueriesSync: [query],
    })

    let mutationProcessed = false
    const store = new StandardStore()
    const { fetchMore } = store.registerQuery(
      query.withOptions({ arguments: { x: 1 } }),
      {
        onData: (data) => {
          if (data.length === 1) {
            setTimeout(() =>
              fetchMore(query.withOptions({ arguments: { x: 2 } }))
            )
          } else if (!mutationProcessed) {
            mutationProcessed = true
            store.processMutation(mutation)
          } else {
            expect(data).toStrictEqual(["1-3", "2-4"]) // refetched values
            done()
          }
        },
      }
    )
  })

  /** same code as async case but uses "refetchQueriesSync" instead of "refetchQueries" */
  it("should remove inactive queries' data [sync mode]", (done) => {
    let count = 0
    const query = new Query("GetData", () => Promise.resolve(++count))
    const mutation = new Mutation(jest.fn().mockResolvedValue(null), {
      refetchQueriesSync: [query],
    })

    const store = new StandardStore()
    const { unregister } = store.registerQuery(query, {
      onData: () =>
        setTimeout(() => {
          unregister() // make the query inactive
          store.processMutation(mutation, {
            onComplete: () =>
              store.registerQuery(query, {
                onData: (data) => {
                  // refetched value as previous value was already removed from cache
                  expect(data).toBe(2)
                  done()
                },
              }),
          })
        }),
    })
  })
})
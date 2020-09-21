import StandardStore from "./StandardStore"
import { Query } from "../../query/Query"
import { Mutation } from "../../query/Mutation"
import { NormalizedType } from "../../normalization/NormalizedType"
import { LocalQuery } from "../../query/LocalQuery"

afterEach(() => {
  // @ts-ignore
  Query.registry = new Map()
  // @ts-ignore
  Mutation.registry = new Map()
  // @ts-ignore
  NormalizedType.registry = new Map()
})

describe("callbacks", () => {
  it("should execute mutate function and invoke callbacks", (done) => {
    const result = { value: { x: "y" } }
    const fn = jest
      .fn()
      .mockImplementation(() => new Promise((r) => setTimeout(() => r(result))))

    const args = { test: { message: "blah" } }
    const context = { token: "xyz", extra: { test: true } }
    const mutation = new Mutation("UpdateData", fn, {
      arguments: args,
      context,
    })

    const onRequest = jest.fn()

    const store = new StandardStore()
    store.processMutation(mutation, {
      onRequest,
      onComplete: () => {
        expect(onRequest).toBeCalled()
        expect(fn).toBeCalledWith(args, context)
        done()
      },
    })
  })

  it("should invoke error callback", (done) => {
    const errMsg = "a strang error"
    const fn = jest.fn().mockRejectedValue(errMsg)
    const mutation = new Mutation("UpdateData", fn)

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
      "UpdateData",
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
      {
        shape: [UserType],
        mutations: {
          AddUser: (existingData, { optimistic, mutationResult }) => {
            // this function is called twice, but we should add to list only once
            return optimistic ? [...existingData, mutationResult] : existingData
          },
        },
      }
    )
    const mutation = new Mutation(
      "AddUser",
      () =>
        new Promise(
          // prettier-ignore
          (r) => setTimeout(() => r({ username: "z", email: "z@test.com", __optimistic__: false }))
        ),
      {
        shape: UserType,
        // prettier-ignore
        optimisticResponse: { username: "z", email: "z@test.com", __optimistic__: true },
      }
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
    store.processMutation(mutation)
  })

  it("should ignore optimistic value when real res. is immediately available", (done) => {
    const mutation = new Mutation("UpdateData", () => Promise.resolve(2), {
      optimisticResponse: 1,
      beforeQueryUpdates: (_, { mutationResult: data }) => {
        if (data === 1) {
          throw new Error(`Unexpected callback with response: ${data}.`)
        } else {
          expect(data).toBe(2)
          done()
        }
      },
    })

    const store = new StandardStore()
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

    const mutation = new Mutation(
      "UpdateData",
      jest.fn().mockResolvedValue(null),
      {
        refetchQueries: [query.withOptions({ arguments: { name: "x" } })],
      }
    )

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
    const mutation = new Mutation(
      "UpdateData",
      jest.fn().mockResolvedValue(null),
      {
        refetchQueriesSync: [query],
      }
    )

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
    const mutation = new Mutation(
      "UpdateData",
      jest.fn().mockResolvedValue(null),
      {
        refetchQueries: [query],
      }
    )

    let mutationTriggered = false
    let mutationCompleted = false
    const store = new StandardStore()
    const { fetchMore } = store.registerQuery(
      query.withOptions({ arguments: { x: 1 } }),
      {
        onData: (data) => {
          if (data.length === 1) {
            setTimeout(() =>
              fetchMore(query.withOptions({ arguments: { x: 2 } }))
            )
          } else if (!mutationTriggered) {
            mutationTriggered = true
            store.processMutation(mutation, {
              onComplete: () => (mutationCompleted = true),
            })
          } else if (mutationCompleted) {
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
    const mutation = new Mutation(
      "UpdateData",
      jest.fn().mockResolvedValue(null),
      {
        refetchQueries: [query],
      }
    )

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
    const mutation = new Mutation(
      "UpdateData",
      jest.fn().mockResolvedValue(null),
      {
        refetchQueriesSync: [query],
      }
    )

    let mutationTriggered = false
    let mutationCompleted = false
    const store = new StandardStore()
    const { fetchMore } = store.registerQuery(
      query.withOptions({ arguments: { x: 1 } }),
      {
        onData: (data) => {
          if (data.length === 1) {
            setTimeout(() =>
              fetchMore(query.withOptions({ arguments: { x: 2 } }))
            )
          } else if (!mutationTriggered) {
            mutationTriggered = true
            store.processMutation(mutation, {
              onComplete: () => (mutationCompleted = true),
            })
          } else if (mutationCompleted) {
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
    const mutation = new Mutation(
      "UpdateData",
      jest.fn().mockResolvedValue(null),
      {
        refetchQueriesSync: [query],
      }
    )

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

describe("beforeQueryUpdates()", () => {
  it("should be passed mutation arguments and context", (done) => {
    const args = { x: { y: "z" }, t: "t" }
    const context = { token: "aaa", extra: { smth: true } }

    const mutation = new Mutation("UpdateData", () => Promise.resolve(), {
      beforeQueryUpdates: (_, { mutationArgs }) => {
        expect(mutationArgs).toStrictEqual(args)
        done()
      },
    })
    const store = new StandardStore()
    store.processMutation(mutation.withOptions({ arguments: args, context }))
  })

  it("should add normalized object", (done) => {
    // prettier-ignore
    const UserType = NormalizedType.register("User", { keyFields: ["username"] })
    const query = new Query(
      "GetUsers",
      () => Promise.resolve([{ username: "x", email: "x@test.com" }]),
      {
        shape: [UserType],
        mutations: {
          // prettier-ignore
          AddUser: (currentValue, { context: { newUserRef } }) => [...currentValue, newUserRef],
        },
      }
    )
    const mutation = new Mutation("AddUser", () => Promise.resolve(), {
      beforeQueryUpdates: (cache) => {
        // prettier-ignore
        const ref = cache.addObject(UserType, { username: "y", email: "y@t.s", avatar: "http" })
        return { newUserRef: ref }
      },
    })
    const store = new StandardStore()
    store.registerQuery(query, {
      onData: (data) => {
        if (data.length === 1) {
          setTimeout(() => store.processMutation(mutation))
        } else {
          expect(data[1]).toStrictEqual({ username: "y", email: "y@t.s" })
          done()
        }
      },
    })
  })

  it("should update normalized object", (done) => {
    // prettier-ignore
    const UserType = NormalizedType.register("User", { keyFields: ["username"] })
    const query = new Query(
      "GetUsers",
      () =>
        Promise.resolve({ username: "x", email: "x@test.com", avatar: "http" }),
      { shape: UserType }
    )
    const mutation = new Mutation("UpdateData", () => Promise.resolve(), {
      beforeQueryUpdates: (cache) => {
        const ref = cache.findObjectRef(UserType, { username: "x" })!
        cache.updateObject(ref, {
          ...cache.readObject(ref),
          email: "new-x@t.s",
        })
      },
    })

    let updated = false
    const store = new StandardStore()
    store.registerQuery(query, {
      onData: (data) => {
        if (!updated) {
          updated = true
          setTimeout(() => store.processMutation(mutation))
        } else {
          // prettier-ignore
          expect(data).toStrictEqual({ username: "x", email: "new-x@t.s", avatar: "http" })
          done()
        }
      },
    })
  })

  it("should delete normalized object", (done) => {
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

    const mutation = new Mutation("UpdateData", () => Promise.resolve(), {
      beforeQueryUpdates: (cache) =>
        cache.deleteObject(cache.findObjectRef(UserType, { username: "x" })!),
    })
    store.processMutation(mutation)
  })
})

describe("afterQueryUpdates()", () => {
  it("should work", (done) => {
    const query = new LocalQuery<string>("UserId")
    const mutation = new Mutation("UpdateData", () => Promise.resolve(), {
      afterQueryUpdates: (store) => store.setQueryData(query, "nguyen"),
    })

    const store = new StandardStore()
    store.processMutation(mutation, {
      onComplete: () => {
        setTimeout(() =>
          store.registerLocalQuery(query, {
            onData: (data) => {
              expect(data).toBe("nguyen")
              done()
            },
          })
        )
      },
    })
  })
})

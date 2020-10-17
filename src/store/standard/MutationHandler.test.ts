import { AdvancedStore } from "../AdvancedStore"
import { createStore } from "../createStore"
import {
  Query,
  LocalQuery,
  Mutation,
  NormalizedType,
  LocalMutation,
  NormalizedObjectRef,
} from "../../common"

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

    const store = createStore() as AdvancedStore
    store.processMutation(mutation, {
      onRequest,
      onComplete: (data) => {
        expect(onRequest).toBeCalled()
        expect(fn).toBeCalledWith(args, context, store)
        expect(data).toBe(result)
        done()
      },
    })
  })

  it("should invoke error callback", (done) => {
    const errMsg = "a strang error"
    const fn = jest.fn().mockRejectedValue(errMsg)
    const mutation = new Mutation("UpdateData", fn)

    jest.spyOn(console, "error").mockImplementation(() => {})
    const store = createStore() as AdvancedStore
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

    const store = createStore() as AdvancedStore
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

    const store = createStore() as AdvancedStore
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

    const store = createStore() as AdvancedStore
    store.processMutation(mutation)
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
    const store = createStore() as AdvancedStore
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
          AddUser: (currentValue, { mutationResult: newUserRef }) => [...currentValue, newUserRef],
        },
      }
    )
    const mutation = new Mutation(
      "AddUser",
      () => Promise.resolve({ username: "y", email: "y@t.s", avatar: "http" }),
      {
        shape: UserType,
      }
    )
    const store = createStore() as AdvancedStore
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
    const store = createStore() as AdvancedStore
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

    const store = createStore() as AdvancedStore
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
    const query = new LocalQuery<string>("UserId", { initialValue: "nothing" })
    const mutation = new Mutation("UpdateData", () => Promise.resolve(), {
      afterQueryUpdates: (store) => store.setQueryData(query, "something"),
    })

    const store = createStore() as AdvancedStore
    store.processMutation(mutation, {
      onComplete: () => {
        setTimeout(() =>
          store.registerLocalQuery(query, {
            onData: (data) => {
              expect(data).toBe("something")
              done()
            },
          })
        )
      },
    })
  })
})

describe("syncMode", () => {
  it("should be async by default", (done) => {
    let count = 0
    const query = new Query(
      "GetX",
      () => new Promise<number>((r) => setTimeout(() => r(++count)))
    )
    const mutation = new Mutation(
      "UpdateData",
      jest.fn().mockResolvedValue(null),
      {
        afterQueryUpdates: (store) => store.query(query),
      }
    )

    const store = createStore() as AdvancedStore
    store.processMutation(mutation, {
      onComplete: () => {
        expect(count).toBe(0) // onComplete is called BEFORE query is fetched
        done()
      },
    })
  })

  it("should be sync when explicitly set", (done) => {
    let count = 0
    const query = new Query(
      "GetY",
      () => new Promise<number>((r) => setTimeout(() => r(++count)))
    )
    let dataFetched = false
    const mutation = new Mutation(
      "UpdateData",
      jest.fn().mockResolvedValue(null),
      {
        afterQueryUpdates: async (store) => {
          const val = await store.query(query)
          expect(val).toBe(1)
          dataFetched = true
        },
        syncMode: true,
      }
    )

    const store = createStore() as AdvancedStore
    store.processMutation(mutation, {
      onComplete: () => {
        expect(dataFetched).toBe(true)
        done()
      },
    })
  })

  it("should be sync even when afterQueryUpdates() doesn't return a promise", (done) => {
    let happened = false
    const mutation = new Mutation(
      "UpdateData",
      jest.fn().mockResolvedValue(null),
      {
        afterQueryUpdates: () => {
          happened = true
        },
        syncMode: true,
      }
    )

    const store = createStore() as AdvancedStore
    store.processMutation(mutation, {
      onComplete: () => {
        expect(happened).toBe(true)
        done()
      },
    })
  })

  it("should call onError if afterQueryUpdates() throws", (done) => {
    const mutation = new Mutation(
      "UpdateData",
      jest.fn().mockResolvedValue(null),
      {
        afterQueryUpdates: jest.fn().mockRejectedValue("strange err"),
        syncMode: true,
      }
    )

    const store = createStore() as AdvancedStore
    store.processMutation(mutation, {
      onError: (err) => {
        expect(err).toBe("strange err")
        done()
      },
    })
  })

  it("should NOT call onError if afterQueryUpdates() throws in async mode", (done) => {
    const mutation = new Mutation(
      "UpdateData",
      jest.fn().mockResolvedValue(null),
      {
        afterQueryUpdates: () => {
          setTimeout(done)
          return Promise.reject("strange err")
        },
      }
    )

    const store = createStore() as AdvancedStore
    store.processMutation(mutation, {
      onError: () => {
        throw new Error("onError is unexpectedly called")
      },
      // onComplete: done,
    })
  })
})

describe("LocalMutation", () => {
  it("should update cache and notify active queries", (done) => {
    const UserType = NormalizedType.register("User")
    const query = new Query(
      "GetUsers",
      () =>
        Promise.resolve([
          { id: 1, email: "x@test.com" },
          { id: 2, email: "y@test.com" },
        ]),
      { shape: [UserType] }
    )
    const mutation = new LocalMutation("UpdateUser", { inputShape: UserType })
    const updatedUser2 = { id: 2, email: "new-y@test.com" }

    expect.assertions(2)
    const store = createStore() as AdvancedStore
    store.registerQuery(query, {
      onData: (data) => {
        const user2 = data.find((u) => u.id === 2)!
        if (user2.email === "y@test.com") {
          setTimeout(() =>
            store.processLocalMutation(
              mutation.withOptions({ input: updatedUser2 }),
              {
                onComplete: (r) => {
                  expect(r).toStrictEqual(updatedUser2)
                  done()
                },
              }
            )
          )
        } else {
          expect(user2).toStrictEqual(updatedUser2)
        }
      },
    })
  })

  it("should update related queries", (done) => {
    const UserType = NormalizedType.register("User")
    const query = new Query(
      "GetUsers",
      () => Promise.resolve([{ id: 1, email: "x@test.com" }]),
      {
        shape: [UserType],
        mutations: {
          NewUser: (currentList, { mutationResult: newUserRef }) => [
            ...currentList,
            newUserRef,
          ],
        },
      }
    )
    const user2 = { id: 2, email: "y@test.com" }
    const mutation = new LocalMutation("NewUser", {
      input: user2,
      inputShape: UserType,
    })

    const store = createStore() as AdvancedStore
    store.registerQuery(query, {
      onData: (data) => {
        if (data.length === 1) {
          setTimeout(() => store.processLocalMutation(mutation))
        } else {
          expect(data[1]).toStrictEqual(user2)
          done()
        }
      },
    })
  })

  it("should invoke beforeQueryUpdates() and afterQueryUpdates()", (done) => {
    const UserType = NormalizedType.register("User")
    const mutation = new LocalMutation("NewUser", {
      inputShape: UserType,
      beforeQueryUpdates: (cache, { mutationInput }) => {
        expect(cache.updateObject).toBeTruthy()
        expect(mutationInput).toBeInstanceOf(NormalizedObjectRef)
      },
      afterQueryUpdates: (s, { mutationInput }) => {
        expect(s).toBe(store)
        expect(mutationInput).toStrictEqual(updatedUser2)
        done()
      },
    })
    const updatedUser2 = { id: 1, email: "y@test.com" }

    expect.assertions(4)
    const store = createStore() as AdvancedStore
    store.processLocalMutation(mutation.withOptions({ input: updatedUser2 }))
  })

  it("should invoke onComplete after afterQueryUpdates() in syncMode", (done) => {
    let called = false
    const mutation = new LocalMutation("Test", {
      afterQueryUpdates: () => {
        called = true
      },
      syncMode: true,
    })

    const store = createStore() as AdvancedStore
    store.processLocalMutation(mutation, {
      onComplete: () => {
        expect(called).toBe(true)
        done()
      },
    })
  })
})

import { AdvancedStore } from "../AdvancedStore"
import { createStore } from "../createStore"
import {
  Query,
  LocalQuery,
  Mutation,
  NormalizedType,
  LocalMutation,
} from "../../common"

beforeEach(() => {
  // @ts-ignore
  Query.registry = new Map()
  // @ts-ignore
  Mutation.registry = new Map()
  // @ts-ignore
  NormalizedType.registry = new Map()
})

describe("LocalQuery", () => {
  it("should callback with initial value, then with set data", (done) => {
    const initialValue = { msg: null }
    const testPayload = { msg: "Hello, World" }
    const query = new LocalQuery("SomeLocalState", { initialValue })
    const mutation = new Mutation(
      "UpdateData",
      () => Promise.resolve(testPayload),
      {
        queryUpdates: {
          SomeLocalState: (_, { mutationResult }) => mutationResult,
        },
      }
    )
    const store = createStore() as AdvancedStore
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

describe("Query options", () => {
  test("user-provided selector", (done) => {
    const ProductType = NormalizedType.register("Product")
    const query = new Query(
      "Products",
      () => new Promise((r) => setTimeout(() => r([]))),
      {
        shape: [ProductType],
        selector: ["id", "name"],
      }
    )
    const mutation = new Mutation(
      "AddProduct",
      () =>
        new Promise((r) => setTimeout(() => r({ id: 1, name: "Product A" }))),
      {
        resultShape: ProductType,
        queryUpdates: {
          Products: (currentList, { mutationResult: newProductRef }) => [
            ...currentList,
            newProductRef,
          ],
        },
      }
    )

    const store = createStore() as AdvancedStore
    store.registerQuery(query, {
      onData: (data: any) => {
        if (data.length === 0) {
          setTimeout(() => store.processMutation(mutation))
        } else {
          expect(data[0]).toStrictEqual({ id: 1, name: "Product A" })
          done()
        }
      },
    })
  })

  test("queryUpdates", (done) => {
    let count = 10
    const query = new Query(
      "UsersQuery",
      (args: { page: number }) =>
        new Promise((r) =>
          setTimeout(() => r({ userCount: count++, users: [] }))
        ),
      {
        queryUpdates: {
          UsersQuery: (
            currentValue,
            { relatedQueryResult, relatedQueryArgs, queryArgs }
          ) => {
            return queryArgs.page === relatedQueryArgs.page
              ? currentValue
              : {
                  ...currentValue,
                  userCount: relatedQueryResult.userCount,
                }
          },
        },
      }
    )

    const store = createStore() as AdvancedStore
    store.registerQuery(query.withOptions({ arguments: { page: 1 } }), {
      onData: (data: any) => {
        if (data.userCount === 10) {
          setTimeout(() =>
            store.registerQuery(query.withOptions({ arguments: { page: 2 } }), {
              onData: jest.fn(),
            })
          )
        } else {
          expect(data.userCount).toBe(11) // updated following 2nd query's result
          done()
        }
      },
    })
  })
})

describe("query()", () => {
  it("should load and return data", async () => {
    const query = new Query("GetData", jest.fn().mockResolvedValue("hello"))
    const store = createStore() as AdvancedStore
    const result = await store.query(query)
    expect(result).toBe("hello")
  })

  it("should load and return error", async () => {
    // prettier-ignore
    const query = new Query("GetData", jest.fn().mockRejectedValue("strange error"))
    const store = createStore() as AdvancedStore

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
    const store = createStore() as AdvancedStore

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
    const store = createStore() as AdvancedStore

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
    const store = createStore() as AdvancedStore

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
    const store = createStore() as AdvancedStore

    store.query(query).then(() => {
      store.registerQuery(query, {
        onData: (data) => {
          expect(data).toBe(1) // cached value
          done()
        },
      })
    })
  })

  it("should return data even when request is deduped", (done) => {
    let count = 0
    const query = new Query(
      "GetData",
      () => new Promise((r) => setTimeout(() => r(++count)))
    )
    const store = createStore() as AdvancedStore

    store.registerQuery(query, {
      onRequest: () => {
        setTimeout(async () => {
          const result = await store.query(query)
          expect(result).toBe(1) // cached value
          done()
        })
      },
      onData: jest.fn(),
    })
  })
})

describe("mutate()", () => {
  it("should work", async () => {
    const args = { a: "bc" }
    const mutateFn = jest.fn().mockResolvedValue(null)
    const fn1 = jest.fn()
    const fn2 = jest.fn()
    const mutation = new Mutation("UpdateData", mutateFn, {
      beforeQueryUpdates: fn1,
      afterQueryUpdates: fn2,
      syncMode: true,
    })

    const store = createStore() as AdvancedStore
    await store.mutate(mutation, { arguments: args })

    expect(mutateFn).toBeCalledWith(args, {}, store)
    expect(fn1).toBeCalled()
    expect(fn2).toBeCalled()
  })
})

describe("mutateLocal()", () => {
  it("should work", async () => {
    const input = { a: "bc" }
    const fn1 = jest.fn()
    const fn2 = jest.fn()
    const mutation = new LocalMutation("UpdateData", {
      beforeQueryUpdates: fn1,
      afterQueryUpdates: fn2,
      syncMode: true,
    })

    const store = createStore() as AdvancedStore
    await store.mutateLocal(mutation.withOptions({ input }))

    expect(fn1).toBeCalled()
    expect(fn2).toBeCalledWith(store, { mutationInput: input })
  })
})

describe("refetchQueries()", () => {
  it("should work", (done) => {
    let count = 0
    // prettier-ignore
    const query = new Query("GetData", (args: { name: string }) => Promise.resolve(++count))
    const q1 = query.withOptions({ arguments: { name: "x" } })
    const q2 = query.withOptions({ arguments: { name: "y" } })

    let refetched = false
    const store = createStore() as AdvancedStore
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
        if (countValue === 2 && !refetched) {
          refetched = true
          store.refetchQueries([
            query.withOptions({ arguments: { name: "x" } }),
          ])
        } else if (countValue !== 2) {
          throw new Error("Query is unexpectedly refetched.")
        }
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
        afterQueryUpdates: (store) => store.refetchQueries([query]),
      }
    )

    let mutationTriggered = false
    let mutationCompleted = false
    const store = createStore() as AdvancedStore
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
    const query = new Query(
      "GetData",
      () => new Promise<number>((r) => setTimeout(() => r(++count)))
    )

    const store = createStore() as AdvancedStore
    const { unregister } = store.registerQuery(query, {
      onData: async () => {
        unregister() // make the query inactive
        await store.refetchQueries([query])
        expect(store.getQueryData(query)).toBeFalsy()
        done()
      },
    })
  })

  it("should fetch related active queries when arguments not provided", (done) => {
    let count = 0
    // prettier-ignore
    const query = new Query("GetData", (args: { name: string }) => Promise.resolve(++count))
    const q1 = query.withOptions({ arguments: { name: "x" } })
    const q2 = query.withOptions({ arguments: { name: "y" } })
    const q3 = query.withOptions({ arguments: { name: "z" } })

    let refeched = false
    const store = createStore() as AdvancedStore
    const { unregister: unregisterQ1 } = store.registerQuery(q1, {
      onData: (countValue) => expect(countValue).toBe(1), // should not be refetched
    })
    store.registerQuery(q2, {
      onData: (countValue) => expect(`${countValue}`).toMatch(/[24]/), // 1st fetch: 2 -> refetch: 4
    })
    store.registerQuery(q3, {
      onData: (countValue) => {
        // 1st fetch: 3
        if (countValue === 3 && !refeched) {
          refeched = true
          unregisterQ1() // make q1 inactive
          store.refetchQueries([query])
        } else if (countValue > 3) {
          // refetched: 5
          expect(countValue).toBe(5)
          expect(store.getQueryData(q1)).toBeFalsy() // q1 has been removed from cache
          done()
        }
      },
    })
  })

  it("should fetch related queries when partial arguments provided", (done) => {
    let count = 0
    // prettier-ignore
    const query = new Query("GetData", (args: { name: string, page: number }) => Promise.resolve(++count))
    const q1 = query.withOptions({ arguments: { name: "x", page: 1 } })
    const q2 = query.withOptions({ arguments: { name: "y", page: 1 } })
    const q3 = query.withOptions({ arguments: { name: "y", page: 2 } })

    let refeched = false
    const store = createStore() as AdvancedStore
    store.registerQuery(q1, {
      onData: (countValue) => expect(countValue).toBe(1), // should not be refetched
    })
    store.registerQuery(q2, {
      onData: (countValue) => expect(`${countValue}`).toMatch(/[24]/), // 1st fetch: 2 -> refetch: 4
    })
    store.registerQuery(q3, {
      onData: (countValue) => {
        // 1st fetch: 3
        if (countValue === 3 && !refeched) {
          refeched = true
          store.refetchQueries([
            // @ts-ignore
            query.withOptions({ arguments: { name: "y" } }),
          ])
        } else if (countValue > 3) {
          // refetched: 5
          expect(countValue).toBe(5)
          done()
        }
      },
    })
  })
})

describe("refetchActiveQueries()", () => {
  it("should work", (done) => {
    let count1 = 0
    const q1 = new Query("Q1", () => Promise.resolve(++count1))
    let count2 = 0
    const q2 = new Query("Q2", () => Promise.resolve([++count2]), {
      merge: (e, n) => [...e, ...n],
    })

    let refetched = false
    const store = createStore() as AdvancedStore
    const q1Reg = store.registerQuery(q1, {
      onData: jest.fn(),
      onComplete: () => setTimeout(() => q1Reg.unregister()), // make Q1 inactive
    })

    const { fetchMore } = store.registerQuery(q2, {
      onData: (data) => {
        if (data.length === 1) {
          setTimeout(() => fetchMore(q2))
        } else if (!refetched) {
          expect(data).toStrictEqual([1, 2])
          refetched = true
          setTimeout(() => store.refetchActiveQueries())
        } else {
          expect(data).toStrictEqual([3, 3]) // same value because of request dedup
          expect(count1).toBe(1) // Q1 wasn't refetched because it's inactive
          done()
        }
      },
    })
  })
})

describe("setQueryData()", () => {
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

    const store = createStore() as AdvancedStore
    store.registerQuery(query, {
      onData: (data) => {
        if (data.length === 1) {
          expect(data[0]).toStrictEqual({
            username: "z",
            email: "z@test.com",
          })
          done()
        }
      },
    })

    store.setQueryData(query.clone(), [{ username: "z", email: "z@test.com" }])
  })

  it("should update compound query result", (done) => {
    const query = new Query("GetData", () => Promise.resolve(1), {
      merge: (e, n) => e + n,
    })
    const store = createStore() as AdvancedStore
    const { fetchMore } = store.registerQuery(query, {
      onData: (data) => {
        if (data === 1) {
          setTimeout(() => fetchMore(query))
        } else if (data === 2) {
          setTimeout(() => store.setQueryData(query.clone(), 1000))
        } else {
          expect(data).toBe(1000)
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
    const store = createStore() as AdvancedStore
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
    const mutation = new Mutation(
      "UpdateData",
      () => Promise.resolve("something"),
      {
        queryUpdates: {
          Profile: (_, { mutationResult }) => mutationResult,
        },
      }
    )
    const store = createStore() as AdvancedStore
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

  it("should refetch only the original request for compound query", (done) => {
    let count = 0
    const query = new Query(
      "GetData",
      (args: { x: number }) => Promise.resolve(`${args.x}-${++count}`),
      {
        merge: (e, n) => n,
      }
    )
    const store = createStore() as AdvancedStore
    const { fetchMore } = store.registerQuery(
      query.withOptions({ arguments: { x: 1 } }),
      {
        onData: (data) => {
          if (data === "1-1") {
            setTimeout(() =>
              fetchMore(query.withOptions({ arguments: { x: 2 } }))
            )
          } else if (data === "2-2") {
            setTimeout(async () => {
              await store.resetStore()
              expect(count).toBe(3) // only refetch once
              done()
            })
          } else {
            expect(data).toBe("1-3") // only the 1st request is refetched
          }
        },
      }
    )
  })
})

describe("change notification", () => {
  const UserType = NormalizedType.register("User")
  const ArticleType = NormalizedType.register("Article", {
    shape: {
      author: UserType,
    },
  })

  describe("saveQueryData()", () => {
    it("should notify related queries", (done) => {
      const q1 = new Query(
        "Q1",
        () => new Promise((r) => setTimeout(() => r({ id: 1, name: "U1" }))),
        { shape: UserType }
      )
      const q2 = new Query(
        "Q2",
        () =>
          new Promise((r) =>
            setTimeout(() =>
              r({
                id: "a1",
                title: "Article #1",
                author: { id: 1, name: "Updated name" },
              })
            )
          ),
        { shape: ArticleType }
      )

      expect.assertions(1)
      let q1Done = false
      let q2Done = false

      const store = createStore() as AdvancedStore
      store.registerQuery(q1, {
        onData: (data: any) => {
          if (data.name === "Updated name") {
            q1Done = true
            if (q2Done) {
              done()
            }
          } else {
            expect(data.name).toBe("U1")
          }
        },
      })

      store.registerQuery(q2, {
        onData: () => {
          q2Done = true
          if (q1Done) {
            done()
          }
        },
      })
    })

    it("should not notify unrelated queries", (done) => {
      const q1 = new Query(
        "Q1",
        () => new Promise((r) => setTimeout(() => r({ id: 1, name: "U1" }))),
        { shape: UserType }
      )
      const q2 = new Query(
        "Q2",
        () =>
          new Promise((r) =>
            setTimeout(() =>
              r({
                id: "a1",
                title: "Article #1",
                author: { id: 2, name: "U2" },
              })
            )
          ),
        { shape: ArticleType }
      )

      const q1Handler = jest.fn()
      const store = createStore() as AdvancedStore
      store.registerQuery(q1, { onData: q1Handler })
      store.registerQuery(q2, {
        onData: () => {
          expect(q1Handler).toBeCalledTimes(1)
          done()
        },
      })
    })
  })

  test("saveMoreQueryData()", (done) => {
    const q1 = new Query(
      "Q1",
      () =>
        new Promise((r) =>
          setTimeout(() =>
            r({
              id: "a1",
              title: "Article #1",
              author: { id: 2, name: "Original name" },
            })
          )
        ),
      { shape: ArticleType }
    )

    let userCount = 0
    const q2 = new Query(
      "Q2",
      () =>
        new Promise((r) =>
          setTimeout(() => r([{ id: ++userCount, name: `U${userCount}` }]))
        ),
      {
        shape: [UserType],
        merge: (existingData, newData) => [...existingData, ...newData],
      }
    )

    expect.assertions(1)
    let q1Done = false
    let q2Done = false

    const store = createStore() as AdvancedStore
    store.registerQuery(q1, {
      onData: (data: any) => {
        if (data.author.name === "U2") {
          q1Done = true
          if (q2Done) {
            done()
          }
        } else {
          expect(data.author.name).toBe("Original name")
        }
      },
    })

    const { fetchMore } = store.registerQuery(q2, {
      onData: (data: any) => {
        if (data.length === 1) {
          setTimeout(() => fetchMore(q2))
        } else {
          q2Done = true
          if (q1Done) {
            done()
          }
        }
      },
    })
  })

  test("updateMutationResult()", (done) => {
    const q1 = new Query(
      "Q1",
      () => new Promise((r) => setTimeout(() => r({ id: 1, name: "User 1" }))),
      { shape: UserType }
    )

    const q2 = new Query(
      "Q2",
      () =>
        new Promise((r) =>
          setTimeout(() =>
            r({
              id: "a1",
              title: "Article #1",
              author: { id: 2, name: "User 2" },
            })
          )
        ),
      { shape: ArticleType }
    )

    const updateUser2Mutation = new Mutation(
      "UpdateUser",
      () => Promise.resolve({ id: 2, name: "U2 Updated" }),
      { resultShape: UserType }
    )

    const q1Handler = jest.fn()
    const store = createStore() as AdvancedStore
    store.registerQuery(q1, {
      onData: q1Handler,
    })

    store.registerQuery(q2, {
      onData: (data: any) => {
        if (data.author.name === "User 2") {
          setTimeout(() => store.processMutation(updateUser2Mutation))
        } else {
          expect(data.author.name).toBe("U2 Updated")
          expect(q1Handler).toBeCalledTimes(1)
          done()
        }
      },
    })
  })

  test("updateRelatedQueries()", (done) => {
    const query = new Query(
      "UsersQuery",
      () =>
        new Promise((r) => setTimeout(() => r([{ id: 1, name: "User 1" }]))),
      { shape: [UserType] }
    )
    const addUserMutation = new Mutation(
      "AddUser",
      () => Promise.resolve({ id: 2, name: "User 2" }),
      {
        resultShape: UserType,
        queryUpdates: {
          UsersQuery: (currentList, { mutationResult: newUserRef }) => [
            ...currentList,
            newUserRef,
          ],
        },
      }
    )
    const updateUserMutation = new Mutation(
      "UpdateUser",
      () => Promise.resolve({ id: 2, name: "Updated Name" }),
      { resultShape: UserType }
    )

    const store = createStore() as AdvancedStore
    store.registerQuery(query, {
      onData: (data: any) => {
        if (data.length === 1) {
          setTimeout(() => store.processMutation(addUserMutation))
        } else {
          const user2 = data[1]
          if (user2.name === "User 2") {
            setTimeout(() => store.processMutation(updateUserMutation))
          } else {
            expect(user2.name).toBe("Updated Name")
            done()
          }
        }
      },
    })
  })

  test("updateRelatedQueries() nested objects", (done) => {
    const query = new Query(
      "ArticlesQuery",
      () =>
        new Promise((r) =>
          setTimeout(() =>
            // prettier-ignore
            r([{ id: "a1", title: "Article 1", author: { id: 1, name: "User 1" } }])
          )
        ),
      { shape: [ArticleType] }
    )
    const addArticleMutation = new Mutation(
      "AddArticle",
      () =>
        Promise.resolve({
          id: "a2",
          title: "Article 2",
          author: { id: 2, name: "User 2" },
        }),
      {
        resultShape: ArticleType,
        queryUpdates: {
          ArticlesQuery: (currentList, { mutationResult: newArticleRef }) => [
            ...currentList,
            newArticleRef,
          ],
        },
      }
    )
    const updateUserMutation = new Mutation(
      "UpdateUser",
      () => Promise.resolve({ id: 2, name: "Updated Name" }),
      { resultShape: UserType }
    )

    const store = createStore() as AdvancedStore
    store.registerQuery(query, {
      onData: (data: any) => {
        if (data.length === 1) {
          setTimeout(() => store.processMutation(addArticleMutation))
        } else {
          const { author } = data[1]
          if (author.name === "User 2") {
            setTimeout(() => store.processMutation(updateUserMutation))
          } else {
            expect(author.name).toBe("Updated Name")
            done()
          }
        }
      },
    })
  })
})

describe("preloadedState", () => {
  it("should work with a trivial query", async () => {
    let count = 0
    const query = new Query(
      "GetX",
      () => new Promise((r) => setTimeout(() => r(++count)))
    )

    // fetch data and save into cache
    const originalStore = createStore()
    await originalStore.query(query)
    const state = JSON.stringify(originalStore.getState())

    // restore store from the serialized state
    const preloadedState = JSON.parse(state)
    const restoredStore = createStore({ preloadedState })

    // verify query's cached data
    expect(restoredStore.getQueryData(query)).toBe(1)
  })

  it("should work with normalized data", async () => {
    const UserType = NormalizedType.register("User", {
      keyFields: ["username"],
    })
    const CommentType = NormalizedType.register("Comment", {
      shape: {
        author: UserType,
      },
    })
    const ArticleType = NormalizedType.register("Article", {
      keyFields: ["slug"],
      shape: {
        author: UserType,
        comments: [CommentType],
      },
    })
    const article = {
      slug: "a1",
      title: "blah",
      author: { username: "u1", name: "Nguyen" },
      comments: [
        { id: 1, author: { username: "u2", name: "Tran" }, body: "blah..." },
        {
          id: 2,
          author: { username: "u1", name: "Nguyen" },
          body: "blah blah...",
        },
      ],
    }
    const userQuery = new Query(
      "GetY1",
      () =>
        new Promise<{ username: string; name: string }>((r) =>
          setTimeout(() => r(article.author))
        ),
      { shape: UserType }
    )
    const articleQuery = new Query(
      "GetY2",
      () => new Promise<typeof article>((r) => setTimeout(() => r(article))),
      { shape: ArticleType }
    )
    const mutation = new LocalMutation("UpdateY", { inputShape: UserType })

    // fetch data and save into cache
    const originalStore = createStore()
    await originalStore.query(userQuery)
    await originalStore.query(articleQuery)
    const state = JSON.stringify(originalStore.getState())

    // restore store from the serialized state
    const preloadedState = JSON.parse(state)
    const restoredStore = createStore({ preloadedState })

    // verify query's cached data
    expect(restoredStore.getQueryData(articleQuery)).toStrictEqual(article)

    // update an object and verify if the change propagates to all related queries
    await restoredStore.mutateLocal(mutation, {
      input: { username: "u1", name: "Le" },
    })
    expect(restoredStore.getQueryData(userQuery)?.name).toBe("Le")
    expect(restoredStore.getQueryData(articleQuery)?.author.name).toBe("Le")
  })

  it("should work with compound object key", async () => {
    const OrderItemType = NormalizedType.register("OrderItem", {
      keyFields: ["orderId", "productId"],
    })
    const order = {
      items: [
        { orderId: 1, productId: "A", quantity: 1, price: 100 },
        { orderId: 1, productId: "B", quantity: 2, price: 50 },
      ],
      notes: "blah blah...",
    }
    const query = new Query(
      "GetZ",
      () => new Promise((r) => setTimeout(() => r(order))),
      {
        shape: {
          items: [OrderItemType],
        },
      }
    )

    // fetch data and save into cache
    const originalStore = createStore()
    await originalStore.query(query)
    const state = JSON.stringify(originalStore.getState())

    // restore store from the serialized state
    const preloadedState = JSON.parse(state)
    const restoredStore = createStore({ preloadedState })

    // verify query's cached data
    expect(restoredStore.getQueryData(query)).toStrictEqual(order)
  })

  it("should notify related queries of changes", async () => {
    const ProductType = NormalizedType.register("Product")
    const product = { id: 1, name: "Laptop" }
    const productQuery = new Query(
      "GetT1",
      () => new Promise<typeof product>((r) => setTimeout(() => r(product))),
      { shape: ProductType }
    )
    const productsQuery = new Query(
      "GetT2",
      () =>
        new Promise<Array<typeof product>>((r) =>
          setTimeout(() => r([product]))
        ),
      { shape: [ProductType] }
    )
    const mutation = new LocalMutation("UpdateT", {
      input: { id: 1, name: "PC" },
      inputShape: ProductType,
    })

    // fetch data and save into cache
    const originalStore = createStore()
    await originalStore.query(productQuery)
    await originalStore.query(productsQuery)
    const state = JSON.stringify(originalStore.getState())

    // restore store from the serialized state
    const preloadedState = JSON.parse(state)
    const restoredStore = createStore({ preloadedState }) as AdvancedStore

    // register the 2 queries
    restoredStore.registerQuery(productQuery, {
      onData: (data) => {
        if (data.name !== "Laptop") {
          expect(data.name).toBe("PC")
        }
      },
    })

    restoredStore.registerQuery(productsQuery, {
      onData: (data) => {
        if (data[0].name !== "Laptop") {
          expect(data[0].name).toBe("PC")
        }
      },
    })

    // mutate data and verify if both queries are notified
    expect.assertions(2)
    await restoredStore.mutateLocal(mutation)
  })
})

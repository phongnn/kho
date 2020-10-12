import { Query, LocalQuery, Mutation, NormalizedType } from "../../common"
import AdvancedStoreImpl from "./AdvancedStoreImpl"

afterEach(() => {
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
    // prettier-ignore
    const mutation = new Mutation("UpdateData", () => Promise.resolve(testPayload))
    const query = new LocalQuery("SomeLocalState", {
      initialValue,
      mutations: {
        UpdateData: (_, { mutationResult }) => mutationResult,
      },
    })
    const store = new AdvancedStoreImpl()
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

describe("query()", () => {
  it("should load and return data", async () => {
    const query = new Query("GetData", jest.fn().mockResolvedValue("hello"))
    const store = new AdvancedStoreImpl()
    const result = await store.query(query)
    expect(result).toBe("hello")
  })

  it("should load and return error", async () => {
    // prettier-ignore
    const query = new Query("GetData", jest.fn().mockRejectedValue("strange error"))
    const store = new AdvancedStoreImpl()

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
    const store = new AdvancedStoreImpl()

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
    const store = new AdvancedStoreImpl()

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
    const store = new AdvancedStoreImpl()

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
    const store = new AdvancedStoreImpl()

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
    const store = new AdvancedStoreImpl()

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

    const store = new AdvancedStoreImpl()
    await store.mutate(mutation, { arguments: args })

    expect(mutateFn).toBeCalledWith(args, {}, store)
    expect(fn1).toBeCalled()
    expect(fn2).toBeCalled()
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
    const store = new AdvancedStoreImpl()
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
    const store = new AdvancedStoreImpl()
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

    const store = new AdvancedStoreImpl()
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
    const store = new AdvancedStoreImpl()
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
    const store = new AdvancedStoreImpl()
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

    const store = new AdvancedStoreImpl()
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
    const store = new AdvancedStoreImpl()
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
    const store = new AdvancedStoreImpl()
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
    const query = new LocalQuery("Profile", {
      initialValue: "nothing",
      mutations: {
        UpdateData: (_, { mutationResult }) => mutationResult,
      },
    })
    // prettier-ignore
    const mutation = new Mutation("UpdateData", () => Promise.resolve("something"))
    const store = new AdvancedStoreImpl()
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
    const store = new AdvancedStoreImpl()
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

      const store = new AdvancedStoreImpl()
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
      const store = new AdvancedStoreImpl()
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

    const store = new AdvancedStoreImpl()
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
      { shape: UserType }
    )

    const q1Handler = jest.fn()
    const store = new AdvancedStoreImpl()
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
})

import { Query } from "../../query/Query"
import { LocalQuery } from "../../query/LocalQuery"
import StandardStore from "./StandardStore"
import { Mutation } from "../../query/Mutation"

afterEach(() => {
  // @ts-ignore
  Query.registry = new Map()
  // @ts-ignore
  Mutation.registry = new Map()
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
    const query = new LocalQuery("Profile", {
      initialValue: "nothing",
      mutations: {
        UpdateData: (_, { mutationResult }) => mutationResult,
      },
    })
    // prettier-ignore
    const mutation = new Mutation("UpdateData", () => Promise.resolve("something"))
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

describe("deleteQuery()", () => {
  it("should refetch active query", (done) => {
    let count = 0
    const query = new Query("GetData", () => Promise.resolve(++count))
    const store = new StandardStore()
    store.registerQuery(query, {
      onData: (data) => {
        if (data === 1) {
          setTimeout(() => store.deleteQuery(query.clone()))
        } else {
          expect(data).toBe(2)
          done()
        }
      },
    })
  })

  it("should refetch active compound query", (done) => {
    let count = 0
    // prettier-ignore
    const query = new Query("GetData", () => Promise.resolve(++count), { merge: (e, n) => e + n })
    const store = new StandardStore()
    const { fetchMore } = store.registerQuery(query, {
      onData: (data) => {
        if (data === 1) {
          // prettier-ignore
          setTimeout(() => fetchMore(query.withOptions({ arguments: { x: 2 } })))
        } else if (data === 3) {
          setTimeout(() => store.deleteQuery(query.clone()))
        } else {
          expect(data).toBe(7) // 3 + 4
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

    const store = new StandardStore()
    let valueSet = false
    store.registerLocalQuery(query, {
      onData: (data) => {
        if (data === "nothing" && !valueSet) {
          valueSet = true
          setTimeout(() => store.processMutation(mutation))
        } else if (data === "something") {
          setTimeout(() => store.deleteQuery(query.clone()))
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

  it("should return data even when request is deduped", (done) => {
    let count = 0
    const query = new Query(
      "GetData",
      () => new Promise((r) => setTimeout(() => r(++count)))
    )
    const store = new StandardStore()

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
    const data = { x: { y: "z" } }
    const mutateFn = jest.fn().mockResolvedValue(data)
    const updateFn = jest.fn()
    const mutation = new Mutation("UpdateData", mutateFn, {
      beforeQueryUpdates: updateFn,
    })

    const store = new StandardStore()
    await store.mutate(mutation, { arguments: args })

    expect(mutateFn).toBeCalledWith(args, {})
    expect(updateFn).toBeCalled()
  })
})

describe("refetchQueries()", () => {
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
        afterQueryUpdates: (store) => {
          store.refetchQueries([
            query.withOptions({ arguments: { name: "x" } }),
          ])
        },
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
        afterQueryUpdates: (store) => store.refetchQueries([query]),
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

// describe('setQueryData()', () => {
// it("should update query result", (done) => {
//   // prettier-ignore
//   const UserType = NormalizedType.register("User", { keyFields: ["username"] })
//   const query = new Query(
//     "GetUsers",
//     () =>
//       Promise.resolve([
//         { username: "x", email: "x@test.com" },
//         { username: "y", email: "y@test.com", avatar: "http://" },
//       ]),
//     { shape: [UserType] }
//   )

//   const store = new StandardStore()
//   store.registerQuery(query, {
//     onData: (data) => {
//       if (data.length === 3) {
//         expect(data[2]).toStrictEqual({
//           username: "z",
//           email: "z@test.com",
//         })
//         done()
//       }
//     },
//   })

//   const mutation = new Mutation(
//     "UpdateData",
//     () => Promise.resolve({ username: "z", email: "z@test.com" }),
//     {
//       shape: UserType,
//       beforeQueryUpdates: (cache, { data }) => {
//         const existingData = cache.readQuery(query) || []
//         cache.updateQuery(query, [...existingData, data])
//       },
//     }
//   )
//   store.processMutation(mutation)
// })

// it("should update compound query result", (done) => {
//   const query = new Query("GetData", () => Promise.resolve(1), {
//     merge: (e, n) => e + n,
//   })
//   const mutation = new Mutation("UpdateData", () => Promise.resolve(), {
//     beforeQueryUpdates: (cache) => cache.updateQuery(query, 1000),
//   })
//   const store = new StandardStore()
//   const { fetchMore } = store.registerQuery(query, {
//     onData: (data) => {
//       if (data === 1) {
//         setTimeout(() => fetchMore(query))
//       } else if (data === 2) {
//         setTimeout(() => store.processMutation(mutation))
//       } else {
//         expect(data).toBe(1000)
//         done()
//       }
//     },
//   })
// })
// })

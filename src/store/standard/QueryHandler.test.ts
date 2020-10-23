import { AdvancedStore } from "../AdvancedStore"
import { createStore } from "../createStore"
import { Query, NormalizedType } from "../../common"

afterEach(() => {
  // @ts-ignore
  Query.registry = new Map()
  // @ts-ignore
  NormalizedType.registry = new Map()
})

describe("fetchPolicy", () => {
  test("cache-first should invoke callback with cached data", (done) => {
    let count = 0
    const q1 = new Query("GetData", () => Promise.resolve(++count))
    const q2 = q1.clone()

    const store = createStore() as AdvancedStore
    const { unregister } = store.registerQuery(q1, {
      onData: (data) => {
        expect(data).toBe(1)
        unregister()
        setTimeout(() =>
          store.registerQuery(q2, {
            onData: (newData) => {
              expect(newData).toBe(1) // use cached value
              expect(count).toBe(1) // don't fetch data again
              done()
            },
          })
        )
      },
    })
  })

  test("cache-and-network should callback with cached data then latest data", (done) => {
    let count = 0
    const q1 = new Query(
      "GetData",
      () => new Promise((r) => setTimeout(() => r(++count))),
      { fetchPolicy: "cache-and-network" }
    )
    const q2 = q1.clone()

    let times = 0
    const store = createStore() as AdvancedStore
    const { unregister } = store.registerQuery(q1, {
      onData: () => {
        unregister()
        setTimeout(() =>
          store.registerQuery(q2, {
            onData: (data) => {
              if (data === 1) {
                times++ // callback with cached value
              } else if (data === 2) {
                times++ // callback with latest value
                expect(times).toBe(2)
                done()
              } else {
                throw new Error(`Unexpected callback with data = ${data}.`)
              }
            },
          })
        )
      },
    })
  })

  test("network-only should not use cached value", (done) => {
    let count = 0
    const q1 = new Query("GetData", () => Promise.resolve(++count))
    const q2 = q1.withOptions({ fetchPolicy: "network-only" })

    const store = createStore() as AdvancedStore
    const { unregister } = store.registerQuery(q1, {
      onData: (data) => {
        expect(data).toBe(1) // value fetched and cached
        unregister()
        setTimeout(() =>
          store.registerQuery(q2, {
            onData: (newData) => {
              expect(newData).toBe(2) // fetch latest value
              done()
            },
          })
        )
      },
    })
  })

  test("network-only should work even when request is de-duped", (done) => {
    let count = 0
    const query = new Query(
      "GetData",
      () => new Promise<number>((r) => setTimeout(() => r(++count)))
    )

    const store = createStore() as AdvancedStore
    store.registerQuery(query, {
      onData: jest.fn(),
      onRequest: () =>
        setTimeout(() =>
          store.registerQuery(
            query.withOptions({ fetchPolicy: "network-only" }),
            {
              onData: (data) => {
                expect(data).toBe(1)
                done()
              },
            }
          )
        ),
    })
  })
})

describe("fetchMore", () => {
  it("should throw error if merge() not defined", (done) => {
    expect.assertions(1)
    const query = new Query("GetData", () => Promise.resolve("Hello"))
    const store = createStore() as AdvancedStore
    const { fetchMore } = store.registerQuery(query, {
      onData: () => {
        setTimeout(() => {
          try {
            fetchMore(query)
          } catch (ex) {
            // prettier-ignore
            expect(ex.message).toMatch(`merge() function not defined for query ${query.name}`)
            done()
          }
        })
      },
    })
  })

  it("should callback with merged result", (done) => {
    let count = 0
    const query = new Query("GetData", () => Promise.resolve(`*${++count}*`), {
      merge: (existingData, newData) => `${existingData}${newData}`,
    })
    const store = createStore() as AdvancedStore
    const { fetchMore } = store.registerQuery(query, {
      onData: (data) => {
        if (data === "*1*") {
          setTimeout(() => fetchMore(query))
        } else {
          expect(data).toBe("*1**2*")
          done()
        }
      },
    })
  })

  it("should allow overriding merge() function", (done) => {
    let count = 0
    const query = new Query("GetData", () => Promise.resolve(`*${++count}*`), {
      merge: (existingData, newData) => `${existingData}${newData}`,
    })
    const nextQuery = new Query(
      "GetNextData",
      () => Promise.resolve(`*${++count}*`),
      {
        merge: (existingData, newData) =>
          `${existingData}${newData}`.replace("**", "*"),
      }
    )
    const store = createStore() as AdvancedStore
    const { fetchMore } = store.registerQuery(query, {
      onData: (data) => {
        if (data === "*1*") {
          setTimeout(() => fetchMore(nextQuery))
        } else {
          expect(data).toBe("*1*2*")
          done()
        }
      },
    })
  })

  it("should work with network-only query", (done) => {
    let count = 0
    const query = new Query(
      "GetData",
      () => new Promise((r) => setTimeout(() => r(++count))),
      {
        fetchPolicy: "network-only",
        merge: (e, n) => e + n,
      }
    )
    const store = createStore() as AdvancedStore
    const { fetchMore } = store.registerQuery(query, {
      onData: (data) => {
        if (data === 1) {
          setTimeout(() => fetchMore(query))
        } else if (data === 3) {
          // 1 + 2
          setTimeout(() => fetchMore(query))
        } else {
          // 3 + 3
          expect(data).toBe(6)
          done()
        }
      },
    })
  })

  it("should work even when request is deduped", (done) => {
    let count = 0
    const query = new Query(
      "GetData",
      () => new Promise<number>((r) => setTimeout(() => r(++count))),
      {
        merge: (existingData, newData) => existingData + newData,
        fetchPolicy: "network-only",
      }
    )
    const store = createStore() as AdvancedStore
    const { fetchMore } = store.registerQuery(query, {
      onData: (data) => {
        if (data === 1) {
          setTimeout(() =>
            store.registerQuery(query, {
              onRequest: () => setTimeout(() => fetchMore(query)), // refetch while 2nd query is in progress
              onData: (d) => expect(d).toBe(2),
            })
          )
        } else {
          expect(data).toBe(3) // 1 + 2
          done()
        }
      },
    })
  })
})

describe("refetch", () => {
  it("should callback with updated data", (done) => {
    let count = 0
    const query = new Query("GetData", () => Promise.resolve(`*${++count}*`))
    const store = createStore() as AdvancedStore
    const { refetch } = store.registerQuery(query, {
      onData: (data) => {
        if (data === "*1*") {
          setTimeout(refetch)
        } else {
          expect(data).toBe("*2*")
          done()
        }
      },
    })
  })

  it("should refetch compound query", (done) => {
    let count = 0
    const query = new Query(
      "GetData",
      (args: { x: number }) =>
        new Promise((r) => setTimeout(() => r(`*${++count}*`))),
      {
        arguments: { x: 1 },
        merge: (existingData, newData) =>
          `${existingData}${newData}`.replace("**", "*"),
      }
    )
    const store = createStore() as AdvancedStore
    const onRequest = jest.fn()
    const onComplete = jest.fn()
    const { fetchMore, refetch } = store.registerQuery(query, {
      onRequest,
      onComplete,
      onData: (data) => {
        if (data === "*1*") {
          setTimeout(() =>
            fetchMore(query.withOptions({ arguments: { x: 2 } }))
          )
        } else if (data === "*1*2*") {
          setTimeout(refetch)
        } else {
          expect(onRequest).toBeCalled()
          expect(onComplete).toBeCalled()
          expect(data).toBe("*3*4*")
          done()
        }
      },
    })
  })

  it("should refetch single-child compound query", (done) => {
    let count = 0
    const query = new Query("GetData", () => Promise.resolve(`*${++count}*`), {
      merge: (existingData, newData) =>
        `${existingData}${newData}`.replace("**", "*"),
    })
    const store = createStore() as AdvancedStore
    const { refetch } = store.registerQuery(query, {
      onData: (data) => {
        if (data === "*1*") {
          setTimeout(refetch)
        } else {
          expect(data).toBe("*2*")
          done()
        }
      },
    })
  })

  test("refetch compound query should work even when request is de-duped", (done) => {
    let count = 0
    const query = new Query(
      "GetData",
      () => new Promise<number>((r) => setTimeout(() => r(++count))),
      {
        merge: (e, n) => e + n,
      }
    )

    const store = createStore() as AdvancedStore
    const { fetchMore, refetch } = store.registerQuery(query, {
      onData: (data) => {
        if (data === 1) {
          setTimeout(() => fetchMore(query))
        } else if (data === 3) {
          // 1 + 2
          setTimeout(refetch)
        } else {
          expect(data).toBe(6) // 3 + 3 (de-duped request -> same value)
          done()
        }
      },
    })
  })

  it("should work with multiple instances of the query", (done) => {
    let count = 0
    const query = new Query(
      "GetData",
      () => new Promise((r) => setTimeout(() => r(++count)))
    )
    const store = createStore() as AdvancedStore
    store.registerQuery(query, {
      onData: (data) => {
        if (data === 1) {
          // @ts-ignore
          const sub = store.registerQuery(query, {
            onData: () => sub.refetch(),
          })
        } else {
          expect(data).toBe(2)
          done()
        }
      },
    })
  })
})

describe("retry", () => {
  it("should work", (done) => {
    let firstCall = true
    const query = new Query("GetData", () => {
      if (firstCall) {
        firstCall = false
        return Promise.reject("Some error")
      }
      return Promise.resolve("Hello!")
    })

    jest.spyOn(console, "error").mockImplementation(() => {})
    const store = createStore() as AdvancedStore
    const { retry } = store.registerQuery(query, {
      onError: (err) => {
        expect(err.message).toMatch(/Some error/)
        setTimeout(retry)
      },
      onData: (data) => {
        expect(data).toBe("Hello!")
        done()
      },
    })
  })
})

describe("expiryMs", () => {
  const intervalMs = 5 * 60 * 1000

  afterEach(() => jest.useRealTimers())

  it("should refetch data when expired", (done) => {
    let count = 0
    const query = new Query("GetX", () => Promise.resolve(++count), {
      expiryMs: intervalMs,
    })
    const store = createStore() as AdvancedStore

    jest.useFakeTimers()
    const { unregister } = store.registerQuery(query, {
      onData: (data) => {
        if (data === 1 || data === 2) {
          process.nextTick(() => jest.advanceTimersByTime(intervalMs))
        } else {
          expect(data).toBe(3)
          unregister()
          done()
        }
      },
    })
  })

  it("should refetch compound query when expired", (done) => {
    let count = 0
    const query = new Query("GetY", () => Promise.resolve([++count]), {
      merge: (existingList, newList) => [...existingList, ...newList],
      expiryMs: intervalMs,
    })
    const store = createStore() as AdvancedStore

    jest.useFakeTimers()
    let refetched = false
    const { unregister, fetchMore } = store.registerQuery(query, {
      onData: (data) => {
        if (data.length === 1) {
          process.nextTick(() => fetchMore(query))
        } else if (!refetched) {
          expect(data).toStrictEqual([1, 2])
          refetched = true
          process.nextTick(() => jest.advanceTimersByTime(intervalMs))
        } else {
          expect(data).toStrictEqual([3, 3]) // same value because of request dedup
          unregister()
          done()
        }
      },
    })
  })
})

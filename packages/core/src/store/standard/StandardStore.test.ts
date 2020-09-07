import StandardStore from "./StandardStore"
import { Query } from "../../query/Query"

afterEach(() => {
  // @ts-ignore
  Query.registry = new Map()
})

describe("fetchMore", () => {
  it("should throw error if merge() not defined", (done) => {
    expect.assertions(1)
    const query = new Query("GetData", () => Promise.resolve("Hello"))
    const store = new StandardStore()
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
    const store = new StandardStore()
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
    const store = new StandardStore()
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
})

describe("refetch", () => {
  it("should callback with updated data", (done) => {
    let count = 0
    const query = new Query("GetData", () => Promise.resolve(`*${++count}*`))
    const store = new StandardStore()
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
      (args: { x: number }) => Promise.resolve(`*${++count}*`),
      {
        arguments: { x: 1 },
        merge: (existingData, newData) =>
          `${existingData}${newData}`.replace("**", "*"),
      }
    )
    const store = new StandardStore()
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
    const store = new StandardStore()
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
})

describe("polling", () => {
  const intervalMs = 5 * 60 * 1000

  afterEach(() => jest.useRealTimers())

  it("should work", (done) => {
    let count = 0
    const query = new Query("GetData", () => Promise.resolve(`*${++count}*`), {
      pollInterval: intervalMs,
    })
    const store = new StandardStore()

    jest.useFakeTimers()
    const { stopPolling } = store.registerQuery(query, {
      onData: (data) => {
        if (data === "*1*" || data === "*2*") {
          process.nextTick(() => jest.advanceTimersByTime(intervalMs))
        } else {
          expect(data).toBe("*3*")
          stopPolling()
          done()
        }
      },
    })
  })

  it("should stop polling", (done) => {
    const query = new Query("GetData", () => Promise.resolve(), {
      pollInterval: intervalMs,
    })
    const store = new StandardStore()

    let counter = 0
    jest.useFakeTimers()
    const { stopPolling } = store.registerQuery(query, {
      onData: () => {
        counter++
        if (counter === 1) {
          process.nextTick(() => jest.advanceTimersByTime(intervalMs))
        } else if (counter === 2) {
          process.nextTick(() => {
            stopPolling()
            setTimeout(done, intervalMs * 5)
            jest.advanceTimersByTime(intervalMs * 5)
          })
        } else if (counter === 3) {
          throw new Error("Polling should have stopped and never call this.")
        }
      },
    })
  })
})

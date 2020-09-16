import Fetcher from "./Fetcher"
import { Query } from "../query/Query"

const testId = "testId"
const testPayload = { payload: { message: "Hello, World!" } }
let fetchData: (args: { id: string }) => Promise<typeof testPayload>
const query = new Query("GetData", (args: { id: string }) => fetchData(args), {
  arguments: { id: testId },
})

let fetcher: Fetcher
beforeEach(() => (fetcher = new Fetcher()))
afterEach(() => {
  // @ts-ignore
  Query.registry = new Map()
})

it("should invoke onComplete and onData callbacks", (done) => {
  fetchData = jest.fn().mockResolvedValue(testPayload)

  fetcher.addRequest(query, {
    onComplete: done,
    onData: (result) => {
      expect(fetchData).toBeCalledWith({ id: testId })
      expect(result).toBe(testPayload)
    },
  })
})

it("should invoke onError callback", (done) => {
  const errMsg = "A strange error"
  fetchData = jest.fn().mockRejectedValue(errMsg)

  jest.spyOn(console, "error").mockImplementation(() => {})
  fetcher.addRequest(query, {
    onData: jest.fn(),
    onError: (err) => {
      expect(err.message).toMatch(errMsg)
      done()
    },
  })
})

describe("request dedup", () => {
  it("should fetch data only once and invoke first onData callback", (done) => {
    fetchData = jest
      .fn()
      .mockImplementation(() => new Promise((r) => setTimeout(r)))
    const q1 = query
    const q2 = q1.clone()
    const q1RequestHandler = jest.fn()
    const q2RequestHandler = jest.fn()
    const q1CompleteHandler = jest.fn()
    const q2CompleteHandler = jest.fn()
    const q2DataHandler = jest.fn()

    fetcher.addRequest(q1, {
      onRequest: q1RequestHandler,
      onComplete: q1CompleteHandler,
      onData: () => {
        setTimeout(() => {
          expect(q1RequestHandler).toBeCalledTimes(1)
          expect(q2RequestHandler).toBeCalledTimes(1)
          expect(q1CompleteHandler).toBeCalledTimes(1)
          expect(q2CompleteHandler).toBeCalledTimes(1)

          expect(fetchData).toBeCalledTimes(1)

          expect(q2DataHandler).not.toBeCalled()
          done()
        })
      },
    })

    fetcher.addRequest(q2, {
      onRequest: q2RequestHandler,
      onComplete: q2CompleteHandler,
      onData: q2DataHandler,
    })
  })

  it("should invoke both onError callbacks", (done) => {
    fetchData = jest.fn().mockRejectedValue("some error")
    const q1 = query
    const q2 = q1.clone()
    let q1ErrorHandlerInvoked = false
    let q2ErrorHandlerInvoked = false

    jest.spyOn(console, "error").mockImplementation(() => {})
    fetcher.addRequest(q1, {
      onData: jest.fn(),
      onError: () => {
        q1ErrorHandlerInvoked = true
        if (q2ErrorHandlerInvoked) {
          done()
        }
      },
    })

    fetcher.addRequest(q2, {
      onData: jest.fn(),
      onError: () => {
        q2ErrorHandlerInvoked = true
        if (q1ErrorHandlerInvoked) {
          done()
        }
      },
    })
  })

  it("should not mistakenly dedup different requests", (done) => {
    fetchData = jest.fn().mockResolvedValue("blah")
    const q1 = new Query("GetData", fetchData, { arguments: { id: "x" } })
    const q2 = new Query("GetData", fetchData, { arguments: { id: "y" } })
    let q1Completed = false
    let q2Completed = false

    expect.assertions(1)
    fetcher.addRequest(q1, {
      onData: () => {
        q1Completed = true
        if (q2Completed) {
          expect(fetchData).toBeCalledTimes(2)
          done()
        }
      },
    })

    fetcher.addRequest(q2, {
      onData: () => {
        q2Completed = true
        if (q1Completed) {
          expect(fetchData).toBeCalledTimes(2)
          done()
        }
      },
    })
  })

  it("should not mistakenly dedup subsequent request", (done) => {
    fetchData = jest.fn().mockResolvedValue("blah")
    fetcher.addRequest(query, {
      onData: () => {
        setTimeout(() => {
          fetcher.addRequest(query, {
            onData: () => {
              expect(fetchData).toBeCalledTimes(2)
              done()
            },
          })
        })
      },
    })
  })
})

/** fetching CompoundQuery: see StandardStore test cases */

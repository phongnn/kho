import Fetcher from "./Fetcher"
import { Query } from "../Query"

const testId = "testId"
const testPayload = { payload: { message: "Hello, World!" } }
let fetchData: (id: string) => Promise<typeof testPayload>
const query = new Query("GetData", (id: string) => fetchData(id), {
  arguments: [testId],
})

let fetcher: Fetcher
beforeEach(() => (fetcher = new Fetcher()))

it("should invoke onComplete callback", (done) => {
  fetchData = jest.fn().mockResolvedValue(testPayload)

  fetcher.addRequest(query, {
    onComplete: (result) => {
      expect(fetchData).toBeCalledWith(testId)
      expect(result).toBe(testPayload)
      done()
    },
  })
})

it("should invoke onError callback", (done) => {
  const errMsg = "A strange error"
  fetchData = jest.fn().mockRejectedValue(errMsg)

  jest.spyOn(console, "error").mockImplementation(() => {})
  fetcher.addRequest(query, {
    onComplete: jest.fn(),
    onError: (err) => {
      expect(err.message).toMatch(errMsg)
      done()
    },
  })
})

describe("request dedup", () => {
  it("should fetch data only once and invoke first onComplete callback", (done) => {
    fetchData = jest.fn().mockResolvedValue(testPayload)
    const q1 = new Query("GetData", fetchData, { arguments: [testId] })
    const q2 = new Query("GetData", fetchData, { arguments: [testId] })
    const q1StartHandler = jest.fn()
    const q2StartHandler = jest.fn()
    const q2CompleteHandler = jest.fn()

    fetcher.addRequest(q1, {
      onStart: q1StartHandler,
      onComplete: () => {
        expect(q1StartHandler).toBeCalledTimes(1)
        expect(q2StartHandler).toBeCalledTimes(1)

        expect(fetchData).toBeCalledTimes(1)

        expect(q2CompleteHandler).not.toBeCalled()
        done()
      },
    })

    fetcher.addRequest(q2, {
      onStart: q2StartHandler,
      onComplete: q2CompleteHandler,
    })
  })

  it("should invoke both onError callbacks", (done) => {
    fetchData = jest.fn().mockRejectedValue("some error")
    const q1 = new Query("GetData", fetchData, { arguments: [testId] })
    const q2 = new Query("GetData", fetchData, { arguments: [testId] })
    let q1ErrorHandlerInvoked = false
    let q2ErrorHandlerInvoked = false

    jest.spyOn(console, "error").mockImplementation(() => {})
    fetcher.addRequest(q1, {
      onComplete: jest.fn(),
      onStart: () => {
        q1ErrorHandlerInvoked = true
        if (q2ErrorHandlerInvoked) {
          done()
        }
      },
    })

    fetcher.addRequest(q2, {
      onComplete: jest.fn(),
      onStart: () => {
        q2ErrorHandlerInvoked = true
        if (q1ErrorHandlerInvoked) {
          done()
        }
      },
    })
  })

  it("should not mistakenly dedup different requests", (done) => {
    fetchData = jest.fn().mockResolvedValue("blah")
    const q1 = new Query("GetData", fetchData, { arguments: ["x"] })
    const q2 = new Query("GetData", fetchData, { arguments: ["y"] })
    let q1Completed = false
    let q2Completed = false

    expect.assertions(1)
    fetcher.addRequest(q1, {
      onComplete: () => {
        q1Completed = true
        if (q2Completed) {
          expect(fetchData).toBeCalledTimes(2)
          done()
        }
      },
    })

    fetcher.addRequest(q2, {
      onComplete: () => {
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
    const query = new Query("GetData", fetchData, { arguments: ["testid"] })
    fetcher.addRequest(query, {
      onComplete: () => {
        setTimeout(() => {
          fetcher.addRequest(query, {
            onComplete: () => {
              expect(fetchData).toBeCalledTimes(2)
              done()
            },
          })
        })
      },
    })
  })
})

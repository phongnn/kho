import { Query } from "../../query/Query"
import { LocalQuery } from "../../query/LocalQuery"
import StandardStore from "./StandardStore"

describe("LocalQuery", () => {
  it("should callback with initial value, then with set data", (done) => {
    const initialValue = { msg: null }
    const testPayload = { msg: "Hello, World" }
    const query = new LocalQuery("SomeLocalState", { initialValue })
    const store = new StandardStore()
    store.registerLocalQuery(query, {
      onData: (data) => {
        if (data === initialValue) {
          setTimeout(() => store.setQueryData(query, testPayload))
        } else {
          expect(data).toBe(testPayload)
          done()
        }
      },
    })
  })
})

describe("resetStore", () => {
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
    const query = new LocalQuery("Profile", { initialValue: "nothing" })
    const store = new StandardStore()
    let valueSet = false
    store.registerLocalQuery(query, {
      onData: (data) => {
        if (data === "nothing" && !valueSet) {
          valueSet = true
          setTimeout(() => store.setQueryData(query, "something"))
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

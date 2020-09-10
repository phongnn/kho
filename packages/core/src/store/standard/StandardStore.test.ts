import { Query } from "../../query/Query"
import { LocalQuery } from "../../query/LocalQuery"
import StandardStore from "./StandardStore"

test("LocalQuery should work", (done) => {
  const testPayload = { msg: "Hello, World" }
  const query = new LocalQuery("SomeLocalState")
  const store = new StandardStore()
  store.registerLocalQuery(query, {
    onData: (data) => {
      expect(data).toBe(testPayload)
      done()
    },
  })
  store.setQueryData(query, testPayload)
})

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

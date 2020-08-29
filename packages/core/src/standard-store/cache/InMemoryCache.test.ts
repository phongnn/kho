import InMemoryCache from "./InMemoryCache"
import { Query } from "../../Query"

const cache = new InMemoryCache()
const q1 = new Query("GetData", jest.fn(), { arguments: ["test", 1] })
const q2 = new Query("GetData", jest.fn(), {
  arguments: ["test", 1],
  fetchPolicy: "cache-first",
})

it("should invoke callback immediately with cached data", (done) => {
  const data = { msg: "blah" }
  cache.subscribe(q1, (result1) => {
    expect(result1).toBe(data)

    setTimeout(() => {
      cache.subscribe(q2, (result2) => {
        expect(result2).toBe(data)
        done()
      })
    })
  })
  cache.storeData(q1, data) // result for q1
})

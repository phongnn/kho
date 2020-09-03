import CacheController from "./CacheController"
import { Query } from "../Query"

afterAll(() => {
  // @ts-ignore
  Query.registry = new Map()
})

const cache = new CacheController()
const q1 = new Query("GetData", jest.fn(), { arguments: { x: "test", y: 1 } })
const q2 = q1.clone()

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
  cache.storeQueryData(q1, data) // result for q1
})

import { Query } from "../../query/Query"
import StandardStore from "./StandardStore"

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

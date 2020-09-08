import { Query } from "../query/Query"
import CompoundQuery from "./CompoundQuery"
import CompoundQueryController from "./CompoundQueryController"

const q1 = new Query("GetData", () => Promise.resolve("arbitrary-string"), {
  merge: (existingData, newData) =>
    `${existingData}${newData}`.replace("**", "*"),
})
const q2 = q1.clone()
const q3 = q1.clone()

const compoundQuery = new CompoundQuery(q1)
compoundQuery.addNextQuery(q2)
compoundQuery.addNextQuery(q3)

it("should invoke onData with latest merged data", (done) => {
  const onComplete = jest.fn()
  const handler = new CompoundQueryController(compoundQuery, {
    onComplete,
    onData: (data) => {
      expect(data).toBe("*1*2*3*")
      expect(onComplete).toBeCalled()
      done()
    },
  })
  handler.handleData(q2, "*2*")
  handler.handleData(q3, "*3*")
  handler.handleData(q1, "*1*")
})

it("should invoke onError", (done) => {
  const err = new Error("strange error")
  const onComplete = jest.fn()
  const onData = jest.fn()
  const handler = new CompoundQueryController(compoundQuery, {
    onComplete,
    onData,
    onError: (e) => {
      expect(e).toBe(err)
      expect(onComplete).not.toBeCalled()
      expect(onData).not.toBeCalled()
      done()
    },
  })
  handler.handleData(q1, "*1*")
  handler.handleError(err)
  handler.handleData(q3, "*3*")
})

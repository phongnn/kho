import React, { useEffect } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Mutation, createStore, Query } from "@fnc/core"

import { useQuery } from "../useQuery"
import { useMutation } from "../useMutation"
import { Provider, useStore } from "../Provider"

let count = 0
const query = new Query("GetData", () => Promise.resolve(++count))
const logOutMutation = new Mutation("Logout", jest.fn().mockResolvedValue(null))

function MyComponent() {
  const store = useStore()
  const { data } = useQuery(query)
  const [logOut, { error, called }] = useMutation(logOutMutation)

  useEffect(() => {
    if (called && !error) {
      store.resetStore()
    }
  }, [store, called, error])

  if (data === null || data === undefined) {
    return null
  }

  return (
    <div>
      <p>Counter: {data}</p>
      <button onClick={() => logOut()}>Log Out</button>
    </div>
  )
}

it("should clear cache and refetch active query", async () => {
  render(
    <Provider store={createStore()}>
      <MyComponent />
    </Provider>
  )

  userEvent.click(await screen.findByText("Log Out"))
  expect(await screen.findByText("Counter: 2")).toBeInTheDocument()
})

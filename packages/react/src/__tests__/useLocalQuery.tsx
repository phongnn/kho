import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LocalQuery, createStore } from "@fnc/core"

import { Provider, useStore } from "../Provider"
import { useLocalQuery } from "../useLocalQuery"

const query = new LocalQuery<{ username: string }>("UserProfile")

function MyComponent() {
  const store = useStore()
  const { data } = useLocalQuery(query)
  if (!data) {
    return (
      <button onClick={() => store.setQueryData(query, { username: "Nguyen" })}>
        Sign In
      </button>
    )
  }

  return <p>Hello, {data.username}!</p>
}

it("should show local data when it becomes available", async () => {
  render(
    <Provider store={createStore()}>
      <MyComponent />
    </Provider>
  )
  userEvent.click(screen.getByText("Sign In"))
  expect(screen.getByText("Hello, Nguyen!")).toBeInTheDocument()
})

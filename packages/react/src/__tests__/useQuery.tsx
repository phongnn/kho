import React from "react"
import { Query, createStore } from "@fnc/core"
import { render, screen } from "@testing-library/react"

import { useQuery } from "../useQuery"
import { Provider } from "../Provider"

const fetchData = (id: string) =>
  new Promise<string>((r) => setTimeout(() => r(`Data for ${id}`), 2000))

const query = new Query("GetData", fetchData)

function MyComponent(props: { id: string }) {
  const { loading, data, error } = useQuery(query, { arguments: [props.id] })
  return (
    <p>{loading ? "loading..." : error ? error.message : data ? data : null}</p>
  )
}

it("should throw error if Provider not found", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  expect.assertions(1)
  try {
    render(<MyComponent id="1" />)
  } catch (ex) {
    expect(ex.message).toMatch(/store not found/)
  }
})

it.only("should show loading state", async () => {
  render(
    <Provider store={createStore()}>
      <MyComponent id="1" />
    </Provider>
  )
  expect(await screen.findByText("loading...")).toBeInTheDocument()
})

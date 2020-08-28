import React from "react"
import { Query, createStore } from "@fnc/core"
import { render, screen } from "@testing-library/react"

import { useQuery } from "../useQuery"
import { Provider } from "../Provider"

let fetcher = (id: string) => Promise.resolve(`data for ${id}`)
const fetchData = (id: string) => fetcher(id) // doing this enables us to replace fetcher with mocks

const query = new Query("GetData", fetchData)

function DataLoadingComponent(props: { id: string }) {
  const { loading, data, error } = useQuery(query, { arguments: [props.id] })
  return (
    <p>{loading ? "loading..." : error ? error.message : data ? data : null}</p>
  )
}

function renderDataLoadingComponent(f?: typeof fetchData) {
  fetcher = f ?? fetcher
  render(
    <Provider store={createStore()}>
      <DataLoadingComponent id="1" />
    </Provider>
  )
}

it("should throw error if Provider not found", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  expect.assertions(1)
  try {
    render(<DataLoadingComponent id="1" />)
  } catch (ex) {
    expect(ex.message).toMatch(/store not found/)
  }
})

it("should show loading state", async () => {
  renderDataLoadingComponent()
  expect(await screen.findByText("loading...")).toBeInTheDocument()
})

it("should show error message", async () => {
  const msg = "Some unknown error"
  renderDataLoadingComponent(() => Promise.reject(msg))
  expect(await screen.findByText(msg)).toBeInTheDocument()
})

it("should show fetched data", async () => {
  const data = "Hello, World!"
  renderDataLoadingComponent(() => Promise.resolve(data))
  expect(await screen.findByText(data)).toBeInTheDocument()
})

import React from "react"
import { Query, createStore } from "@fnc/core"
import { render, screen, waitFor } from "@testing-library/react"
import { useQuery } from "../useQuery"
import { Provider } from "../Provider"

let fetcher: (args: { id: string }) => Promise<any>
const query = new Query("GetData", (args: { id: string }) => fetcher(args))

function DataLoadingComponent(props: { id: string }) {
  // prettier-ignore
  const { loading, data, error } = useQuery(query, { arguments: { id: props.id } })
  return (
    <p>{loading ? "loading..." : error ? error.message : data ? data : null}</p>
  )
}

function renderDataLoadingComponent(f?: typeof fetcher) {
  fetcher =
    f ?? ((args: { id: string }) => Promise.resolve(`Data for ${args.id}`))
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
  renderDataLoadingComponent(() => Promise.reject("Some unknown error"))
  expect(await screen.findByText(/Some unknown error/)).toBeInTheDocument()
})

it("should show fetched data", async () => {
  const data = "Hello, World!"
  renderDataLoadingComponent(() => Promise.resolve(data))
  expect(await screen.findByText(data)).toBeInTheDocument()
})

it("should dedup requests", async () => {
  const data = "Hello, World!"
  fetcher = jest.fn().mockImplementation(() => Promise.resolve(data))

  render(
    <Provider store={createStore()}>
      <>
        <DataLoadingComponent id="1" />
        <DataLoadingComponent id="1" />
      </>
    </Provider>
  )

  await waitFor(() => expect(fetcher).toBeCalled())

  expect(screen.getAllByText(data).length).toBe(2)
  expect(fetcher).toBeCalledTimes(1)
})

test("cache-first fetchPolicy should work", async () => {
  const data = "Hello, World!"
  const store = createStore()
  fetcher = jest.fn().mockImplementation(() => Promise.resolve(data))

  const { rerender } = render(
    <Provider store={store}>
      <DataLoadingComponent id="1" />
    </Provider>
  )
  expect(await screen.findByText(data)).toBeInTheDocument()

  rerender(
    <Provider store={store}>
      <div>
        <DataLoadingComponent id="1" />
      </div>
    </Provider>
  )
  expect(await screen.findByText(data)).toBeInTheDocument()
  expect(fetcher).toBeCalledTimes(1)
})

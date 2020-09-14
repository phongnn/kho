import React from "react"
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Query, createStore } from "@fnc/core"

import { Provider } from "../Provider"
import { useLazyQuery } from "../useLazyQuery"

describe("basic scenarios", () => {
  let fetcher: (args: { x: string; y: number }) => Promise<string>
  const query = new Query("GetX", (args: { x: string; y: number }) =>
    fetcher(args)
  )

  function MyComponent() {
    const [fetchData, { loading, data, error }] = useLazyQuery(query)
    return (
      <div>
        {!data && <p>Click Fetch to load data.</p>}
        {data && <p>{data}</p>}
        {loading && <p>Loading...</p>}
        {error && <p>{error.message}</p>}
        <button onClick={() => fetchData({ arguments: { x: "aaa", y: 1 } })}>
          Fetch
        </button>
      </div>
    )
  }

  it("should load data when invoked", async () => {
    fetcher = jest.fn().mockResolvedValue("hello")
    render(
      <Provider store={createStore()}>
        <MyComponent />
      </Provider>
    )
    expect(screen.getByText("Click Fetch to load data.")).toBeInTheDocument()
    userEvent.click(screen.getByText("Fetch"))
    await waitForElementToBeRemoved(screen.getByText("Loading..."))
    expect(screen.getByText("hello")).toBeInTheDocument()
    expect(fetcher).toBeCalledWith({ x: "aaa", y: 1 })
  })

  it("should show data loading error", async () => {
    fetcher = jest.fn().mockRejectedValue("a strange error")
    render(
      <Provider store={createStore()}>
        <MyComponent />
      </Provider>
    )

    jest.spyOn(console, "error").mockImplementation(() => {})
    userEvent.click(screen.getByText("Fetch"))
    await waitForElementToBeRemoved(screen.getByText("Loading..."))
    expect(screen.getByText(/a strange error/)).toBeInTheDocument()
  })
})

describe("refetch", () => {
  let count = 0
  const query = new Query("GetY", () => Promise.resolve(++count))

  afterEach(() => (count = 0))

  function MyComponent() {
    const [fetchData, { data, refetch }] = useLazyQuery(query)
    return (
      <div>
        {data && <p>data: {data}</p>}
        <button onClick={() => fetchData()}>Fetch</button>
        <button onClick={() => refetch()}>Refetch</button>
      </div>
    )
  }

  it("should work", async () => {
    render(
      <Provider store={createStore()}>
        <MyComponent />
      </Provider>
    )
    userEvent.click(screen.getByText("Fetch"))
    expect(await screen.findByText("data: 1")).toBeInTheDocument()
    userEvent.click(screen.getByText("Refetch"))
    expect(await screen.findByText("data: 2")).toBeInTheDocument()
  })
})

describe("fetchMore", () => {
  const query = new Query("GetZ", () => Promise.resolve(1), {
    merge: (e, n) => e + n,
  })

  function MyComponent() {
    const [fetchData, { data, fetchMore }] = useLazyQuery(query)
    return (
      <div>
        {data && <p>data: {data}</p>}
        <button onClick={() => fetchData()}>Fetch</button>
        <button onClick={() => fetchMore()}>Fetch more</button>
      </div>
    )
  }

  it("should work", async () => {
    render(
      <Provider store={createStore()}>
        <MyComponent />
      </Provider>
    )
    userEvent.click(screen.getByText("Fetch"))
    expect(await screen.findByText("data: 1")).toBeInTheDocument()
    userEvent.click(screen.getByText("Fetch more"))
    expect(await screen.findByText("data: 2")).toBeInTheDocument()
  })
})

describe("call fetch more than once", () => {
  let count = 0
  const query = new Query(
    "GetT",
    () => new Promise((r) => setTimeout(() => r(++count)))
  )

  afterEach(() => (count = 0))

  function MyComponent() {
    const [fetchData, { data }] = useLazyQuery(query)
    return (
      <div>
        {data && <p>data: {data}</p>}
        <button onClick={() => fetchData()}>Fetch</button>
      </div>
    )
  }

  it("should work", async () => {
    render(
      <Provider store={createStore()}>
        <MyComponent />
      </Provider>
    )
    const btnFetch = screen.getByText("Fetch")
    userEvent.click(btnFetch)
    userEvent.click(btnFetch)
    userEvent.click(btnFetch)
    expect(await screen.findByText("data: 1")).toBeInTheDocument()
  })
})

import React, { ReactElement, Suspense } from "react"
import { Query, createStore } from "@fnc/core"
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { useSuspenseQuery } from "../useSuspenseQuery"
import { Provider } from "../Provider"

class ErrorBoundary extends React.Component {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    return error ? <p>{error.message}</p> : this.props.children
  }
}

function renderComponent(Component: ReactElement) {
  render(
    <Provider store={createStore()}>
      <ErrorBoundary>
        <Suspense fallback={<p>Loading...</p>}>{Component}</Suspense>
      </ErrorBoundary>
    </Provider>
  )
}

describe("basic cases", () => {
  let fetcher: () => Promise<any>
  const query = new Query("GetData", () => fetcher())

  function DataLoadingComponent() {
    const { data } = useSuspenseQuery("DLC", query)
    return data ? <p>{data}</p> : null
  }

  it("should load and show data", async () => {
    fetcher = () => Promise.resolve("hello")
    renderComponent(<DataLoadingComponent />)
    await waitForElementToBeRemoved(screen.getByText("Loading..."))
    expect(screen.getByText("hello")).toBeInTheDocument()
  })

  it("should show loading error", async () => {
    fetcher = () => Promise.reject("strange error")
    jest.spyOn(console, "error").mockImplementation(() => {})

    renderComponent(<DataLoadingComponent />)
    await waitForElementToBeRemoved(screen.getByText("Loading..."))
    expect(screen.getByText(/strange error/)).toBeInTheDocument()
  })
})

describe("refetch()", () => {
  let count = 0
  const query = new Query("TestRefetch", () => Promise.resolve(++count))

  function MyComponent() {
    const { data, refetch, refetching } = useSuspenseQuery("TestRefetch", query)
    return !data ? null : (
      <div>
        <p>data: {data}</p>
        <button onClick={() => refetch()}>Refetch</button>
        {refetching && <div>Refetching...</div>}
      </div>
    )
  }

  it("should work", async () => {
    renderComponent(<MyComponent />)
    userEvent.click(await screen.findByText("Refetch"))
    await waitForElementToBeRemoved(screen.getByText("Refetching..."))
    expect(screen.getByText("data: 2")).toBeInTheDocument()
  })
})

describe("fetchMore()", () => {
  let count = 0
  const query = new Query("FetchMore", () => Promise.resolve(++count), {
    merge: (e, n) => e + n,
  })

  function MyComponent() {
    const { data, fetchMore, fetchingMore } = useSuspenseQuery(
      "FetchMore",
      query
    )
    return !data ? null : (
      <div>
        <p>data: {data}</p>
        <button onClick={() => fetchMore()}>More</button>
        {fetchingMore && <div>Fetching...</div>}
      </div>
    )
  }

  it("should work", async () => {
    renderComponent(<MyComponent />)
    const btnMore = await screen.findByText("More")

    userEvent.click(btnMore)
    await waitForElementToBeRemoved(screen.getByText("Fetching..."))
    expect(screen.getByText("data: 3")).toBeInTheDocument() // 1 + 2

    userEvent.click(btnMore)
    await waitForElementToBeRemoved(screen.getByText("Fetching..."))
    expect(screen.getByText("data: 6")).toBeInTheDocument() // 3 + 3
  })
})

import React, { useEffect, useState } from "react"
import { Query, createStore } from "@fnc/core"
import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useQuery } from "../useQuery"
import { Provider } from "../Provider"

let count = 0
let fetchData = () => new Promise((r) => setTimeout(() => r(++count)))
const query = new Query("GetPage", () => Promise.resolve(fetchData()))

afterEach(() => (count = 0))

function DataLoadingComponent() {
  const { data, refetch, refetching, refetchError } = useQuery(query)
  if (!data) {
    return null
  }

  return (
    <div>
      {data !== null && <p>item #{data}</p>}
      <nav>
        <button onClick={refetch}>Refetch</button>
        {refetching && <span>Fetching...</span>}
        {refetchError && <span>{refetchError.message || "Unknown error"}</span>}
      </nav>
    </div>
  )
}

function DoubleComponent() {
  const [rendered, setRendered] = useState(false)
  return (
    <div>
      <DataLoadingComponent />
      <button onClick={() => setRendered(true)}>
        Render another component
      </button>
      {rendered && <DataLoadingComponent />}
    </div>
  )
}

it("should refetch and show latest data", async () => {
  render(
    <Provider store={createStore()}>
      <DataLoadingComponent />
    </Provider>
  )

  const btnRefetch = await screen.findByText("Refetch")
  expect(screen.getByText("item #1")).toBeInTheDocument()

  userEvent.click(btnRefetch)
  await waitForElementToBeRemoved(screen.getByText("Fetching..."))
  expect(screen.getByText("item #2")).toBeInTheDocument()
})

it("should work when component is rendered concurrently", async () => {
  render(
    <Provider store={createStore()}>
      <>
        <DataLoadingComponent />
        <DataLoadingComponent />
      </>
    </Provider>
  )

  const refetchButtons = await screen.findAllByText("Refetch")

  userEvent.click(refetchButtons[1])
  await waitForElementToBeRemoved(screen.getByText("Fetching..."))

  expect(screen.getAllByText("item #2").length).toBe(2)
})

it("should work when component is re-rendered later", async () => {
  render(
    <Provider store={createStore()}>
      <DoubleComponent />
    </Provider>
  )
  await screen.findByText("item #1")
  userEvent.click(screen.getByText("Render another component"))
  await waitFor(() => expect(screen.getAllByText("Refetch").length).toBe(2))

  userEvent.click(screen.getAllByText("Refetch")[1])
  expect((await screen.findAllByText("item #2")).length).toBe(2)
})

it("should show refetch error", async () => {
  render(
    <Provider store={createStore()}>
      <DataLoadingComponent />
    </Provider>
  )

  jest.spyOn(console, "error").mockImplementation(() => {})
  fetchData = jest.fn().mockRejectedValue("a strange error")

  userEvent.click(await screen.findByText("Refetch"))
  await waitForElementToBeRemoved(screen.getByText("Fetching..."))
  expect(screen.getByText(/a strange error/)).toBeInTheDocument()
})

import React from "react"
import { Query, createStore } from "@fnc/core"
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useQuery } from "../useQuery"
import { Provider } from "../Provider"

let count = 0
let fetchData = () => {
  count++
  return Promise.resolve([...Array(5)].map((_, i) => `item #${count}`))
}
const query = new Query("GetPage", () => Promise.resolve(fetchData()))

afterEach(() => (count = 0))

function DataLoadingComponent() {
  const { data, refetch, refetching, refetchError } = useQuery(query)
  if (!data) {
    return null
  }

  return (
    <div>
      <ul>
        {data.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
      <nav>
        <button onClick={refetch}>Refetch</button>
        {refetching && <span>Fetching...</span>}
        {refetchError && <span>{refetchError.message || "Unknown error"}</span>}
      </nav>
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
  expect(screen.getAllByText("item #1").length).toBe(5)

  userEvent.click(btnRefetch)
  await waitForElementToBeRemoved(screen.getByText("Fetching..."))
  expect(screen.getAllByText("item #2").length).toBe(5)
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

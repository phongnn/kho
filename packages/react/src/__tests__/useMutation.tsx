import React from "react"
import { Mutation, createStore } from "@fnc/core"
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { useMutation } from "../useMutation"
import { Provider } from "../Provider"

let mutateFn: (args: any, ctx: any) => Promise<void>
const mutation = new Mutation(
  "UpdateData",
  (args: any, ctx: any) => mutateFn(args, ctx),
  {
    context: { blah: "blah" },
  }
)

function MyComponent() {
  const [mutate, { loading, error, called }] = useMutation(mutation, {
    arguments: { test: true },
    context: { blah: "BLAH" },
  })
  return (
    <div>
      <button
        disabled={loading}
        onClick={() =>
          mutate({ arguments: { x: { y: "z" } }, context: { token: "aaa" } })
        }
      >
        Mutate
      </button>
      {loading && <p>Processing...</p>}
      {error && <p>{error.message || "Unknown error"}</p>}
      {called && <p>Data has been updated successfully.</p>}
    </div>
  )
}

function renderWithMutateFn(fn: typeof mutateFn) {
  mutateFn = fn
  render(
    <Provider store={createStore()}>
      <MyComponent />
    </Provider>
  )
}

it("should invoke mutate function and show success message", async () => {
  const fn = jest.fn().mockResolvedValue(null)
  renderWithMutateFn(fn)

  userEvent.click(screen.getByText("Mutate"))
  await waitForElementToBeRemoved(screen.getByText("Processing..."))
  // prettier-ignore
  expect(screen.getByText("Data has been updated successfully.")).toBeInTheDocument()

  expect(fn).toBeCalledWith({ x: { y: "z" } }, { token: "aaa", blah: "BLAH" })
})

it("should show mutation error", async () => {
  renderWithMutateFn(jest.fn().mockRejectedValue("a strange error"))

  jest.spyOn(console, "error").mockImplementation(() => {})

  userEvent.click(screen.getByText("Mutate"))
  expect(await screen.findByText(/a strange error/)).toBeInTheDocument()
})

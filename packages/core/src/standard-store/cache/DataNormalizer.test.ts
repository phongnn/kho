import DataNormalizer from "./DataNormalizer"
import { NormalizedShape, NormalizedType } from "../../NormalizedType"
import { NormalizedObjectRef } from "./ObjectBucket"

const UserType = NormalizedType.register("User", { keyFields: ["username"] })
const ArticleType = NormalizedType.register("Article", {
  keyFields: ["slug"],
  shape: {
    author: UserType,
    comment: [NormalizedType.of("Comment")],
  },
})
const CommentType = NormalizedType.register("Comment", {
  shape: {
    user: UserType,
  },
})

// const shape: Selector = ["count", ["articles", ["id", "title", ["author", ["username", "email"]]]]]

it("should return normalized object ref", () => {
  const input = { username: "x", email: "x@test.co", age: 30 }
  const shape: NormalizedShape = UserType

  const normalizer = new DataNormalizer(() => null)
  const { result, objects, selector } = normalizer.normalize(input, shape)

  expect(result).toBeInstanceOf(NormalizedObjectRef)
  const { type, key } = result as NormalizedObjectRef
  expect(type).toBe(UserType)
  expect(key.matches({ username: "x" })).toBe(true)

  expect(selector).toStrictEqual(["username", "email", "age"])
  expect(objects.get(UserType)).toStrictEqual([[key, input]])
})

it("should throw error if object key not found", () => {
  const input = { email: "x@test.co", age: 30 }
  const shape: NormalizedShape = UserType

  const normalizer = new DataNormalizer(() => null)
  expect.assertions(1)
  try {
    normalizer.normalize(input, shape)
  } catch (ex) {
    expect(ex.message).toMatch(
      /data of type "User" must contain key field "username"/i
    )
  }
})

it("should return nested object", () => {
  const input = {
    id: "xyz",
    body: "comment goes here...",
    user: { username: "x", avatar: "http://" },
  }
  const shape: NormalizedShape = CommentType
  const normalizer = new DataNormalizer(() => null)
  const { result, objects, selector } = normalizer.normalize(input, shape)

  // verify normalized result
  const { type: commentType, key: commentKey } = result as NormalizedObjectRef
  expect(commentType).toBe(CommentType)
  expect(commentKey.matches({ id: "xyz" })).toBe(true)

  // verify selector
  expect(selector).toStrictEqual([
    "id",
    "body",
    ["user", ["username", "avatar"]],
  ])

  // verify map of normalized objects
  const [commentKey2, commentObj] = objects.get(CommentType)![0]
  expect(commentKey2).toBe(commentKey)
  expect(commentObj.id).toBe("xyz")
  expect(commentObj.body).toBe("comment goes here...")
  expect(commentObj.user).toBeInstanceOf(NormalizedObjectRef)

  expect(objects.get(UserType)).toStrictEqual([
    [commentObj.user.key, input.user],
  ])
})

it.only("should return array of normalized objects", () => {
  const input = [
    { username: "x", email: "x@test.co", age: 30 },
    { username: "y", email: "y@test.co", avatar: "http://" },
  ]
  const shape: NormalizedShape = [UserType]

  const normalizer = new DataNormalizer(() => null)
  const { result, objects, selector } = normalizer.normalize(input, shape)

  // verify normalized result
  expect((result![0] as NormalizedObjectRef).key.matches({ username: "x" }))
  expect((result![1] as NormalizedObjectRef).key.matches({ username: "y" }))

  // verify map of normalized objects
  const userObjects = objects.get(UserType)
  expect(userObjects).toContainEqual([result[0]!.key, input[0]])
  expect(userObjects).toContainEqual([result[1]!.key, input[1]])

  // verify selector
  expect(selector).toStrictEqual(["username", "email", "age", "avatar"])
})

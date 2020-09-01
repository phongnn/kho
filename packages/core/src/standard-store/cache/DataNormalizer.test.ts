import DataNormalizer from "./DataNormalizer"
import { NormalizedShape, NormalizedType } from "../../NormalizedType"
import { NormalizedObjectRef, NormalizedObjectKey } from "./ObjectBucket"

const UserType = NormalizedType.register("User", { keyFields: ["username"] })
const ArticleType = NormalizedType.register("Article", {
  keyFields: ["slug"],
  shape: {
    author: UserType,
    comments: [NormalizedType.of("Comment")],
  },
})
const CommentType = NormalizedType.register("Comment", {
  shape: {
    user: UserType,
  },
})

function normalize(
  data: any,
  shape: NormalizedShape,
  findObjectKey: (plainKey: any) => NormalizedObjectKey | null = () => null
) {
  const normalizer = new DataNormalizer(findObjectKey)
  return normalizer.normalize(data, shape)
}

describe("Single typed object", () => {
  it("should return normalized object ref", () => {
    const input = { username: "x", email: "x@test.co", age: 30 }
    const { result, objects, selector } = normalize(input, UserType)

    expect(result).toBeInstanceOf(NormalizedObjectRef)
    const { type, key } = result as NormalizedObjectRef
    expect(type).toBe(UserType)
    expect(key.matches({ username: "x" })).toBe(true)

    expect(selector.equals(["username", "email", "age"])).toBe(true)
    expect(objects.get(UserType)).toStrictEqual([[key, input]])
  })

  it("should throw error if object key not found", () => {
    const input = { email: "x@test.co", age: 30 }
    expect.assertions(1)
    try {
      normalize(input, UserType)
    } catch (ex) {
      expect(ex.message).toMatch(
        /data of type "User" must contain key field "username"/i
      )
    }
  })

  it("should return null if data is null", () => {
    const { result, selector, objects } = normalize(null, UserType)
    expect(result).toBeNull()
    expect(objects.size).toBe(0)
    expect(selector.equals([])).toBe(true)
  })
})

describe("Nested typed objects", () => {
  it("should return nested object", () => {
    const input = {
      id: "xyz",
      body: "comment goes here...",
      user: { username: "x", avatar: "http://" },
    }
    const { result, objects, selector } = normalize(input, CommentType)

    // verify normalized result
    const { type: commentType, key: commentKey } = result as NormalizedObjectRef
    expect(commentType).toBe(CommentType)
    expect(commentKey.matches({ id: "xyz" })).toBe(true)

    // verify selector
    expect(
      selector.equals(["id", "body", ["user", ["username", "avatar"]]])
    ).toBe(true)

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
})

describe("Array", () => {
  it("should return array of normalized objects", () => {
    const input = [
      { username: "x", email: "x@test.co", age: 30 },
      { username: "y", email: "y@test.co", age: 28 },
    ]
    const { result, objects, selector } = normalize(input, [UserType])

    // verify normalized result
    expect((result![0] as NormalizedObjectRef).key.matches({ username: "x" }))
    expect((result![1] as NormalizedObjectRef).key.matches({ username: "y" }))

    // verify map of normalized objects
    const userObjects = objects.get(UserType)
    expect(userObjects).toContainEqual([result![0].key, input[0]])
    expect(userObjects).toContainEqual([result![1].key, input[1]])

    // verify selector
    expect(selector.equals(["username", "email", "age"])).toBe(true)
  })

  it("should combine selectors", () => {
    const input = [
      { username: "x", email: "x@test.co", age: 30 },
      { username: "y", email: "y@test.co", avatar: "http://" },
    ]
    const { selector } = normalize(input, [UserType])
    expect(selector.equals(["username", "email", "age", "avatar"])).toBe(true)
  })

  it("should throw error if data is not an array", () => {
    const input = { username: "x", email: "x@test.co" }
    expect.assertions(1)
    try {
      normalize(input, [UserType])
    } catch (ex) {
      expect(ex.message).toMatch(/Data is not an array of User/i)
    }
  })

  it("should return empty array if data is null", () => {
    const { result, selector, objects } = normalize(null, [UserType])
    expect(result).toStrictEqual([])
    expect(objects.size).toBe(0)
    expect(selector.equals([])).toBe(true)
  })
})

describe("Nested arrays", () => {
  it("should combine selectors", () => {
    const input = [
      {
        slug: "a1",
        title: "blah",
        comments: [
          { id: 1, body: "comment 1" },
          {
            id: 2,
            body: "comment 2",
            user: { username: "x", avatar: "http://" },
          },
        ],
      },
      {
        slug: "a2",
        author: { username: "y" },
        comments: [
          { id: 3, body: "comment 3", user: { username: "x", email: "x@y" } },
        ],
      },
    ]
    const { selector } = normalize(input, [ArticleType])
    expect(
      selector.equals([
        "slug",
        "title",
        ["author", ["username"]],
        ["comments", ["id", "body", ["user", ["username", "avatar", "email"]]]],
      ])
    ).toBe(true)
  })
})

// TODO: untyped object normalization
// TODO: same object keys

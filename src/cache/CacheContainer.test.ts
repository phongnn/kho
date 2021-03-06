import CacheContainer from "./CacheContainer"
import { Query, NormalizedType, LocalQuery } from "../common"

afterAll(() => {
  // @ts-ignore
  NormalizedType.registry = new Map()
})

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

const queryComments = new Query("comments", jest.fn(), { shape: [CommentType] })
const queryUser = new Query("user", jest.fn(), { shape: UserType })
const comments = [
  {
    id: "c1",
    body: "comment...",
    user: { username: "x", avatar: "http://" },
  },
  { id: "c2", body: "c2...", user: { username: "y", email: "y@xy.z" } },
]
const userX = {
  username: "x",
  email: "newX@email.test",
  avatar: "http://new-avatar",
  extra: {
    blah: "blah",
  },
}

it("should read what it wrote", () => {
  const cache = new CacheContainer()
  const { newCacheKey } = cache.saveQueryData(queryComments, comments)
  const output = cache.get(newCacheKey!)
  expect(output).toStrictEqual(comments)
})

it("should return latest data", () => {
  const cache = new CacheContainer()

  const { newCacheKey } = cache.saveQueryData(queryComments, comments)
  cache.saveQueryData(queryUser, userX) // update one of the commenters' info

  const output = cache.get(newCacheKey!)
  expect(output).toStrictEqual([
    {
      id: "c1",
      body: "comment...",
      user: {
        username: "x",
        email: "newX@email.test",
        avatar: "http://new-avatar",
      },
    },
    { id: "c2", body: "c2...", user: { username: "y", email: "y@xy.z" } },
  ])
})

it("should return null when local data not set", () => {
  const localQuery = new LocalQuery("SignedInUser", { shape: UserType })
  const cache = new CacheContainer()
  const { newCacheKey } = cache.saveQueryData(localQuery, null)
  expect(cache.get(newCacheKey!)).toBe(null)
})

it("should retain null values in query results", () => {
  const data = {
    username: "x",
    avatar: null,
    extra: { info: null, array: [1, 2, null, 4] },
  }
  const localQuery = new LocalQuery("SignedInUser", { shape: UserType })
  const cache = new CacheContainer()
  const { newCacheKey } = cache.saveQueryData(localQuery, data)
  expect(cache.get(newCacheKey!)).toStrictEqual(data)
})

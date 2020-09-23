import CacheContainer from "./CacheContainer"
import { NormalizedType } from "../normalization/NormalizedType"
import { Query } from "../common/Query"

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
  const cacheKey = cache.saveQueryData(queryComments, comments)
  const output = cache.get(cacheKey!)
  expect(output).toStrictEqual(comments)
})

it("should return latest data", () => {
  const cache = new CacheContainer()

  const queryCommentsCacheKey = cache.saveQueryData(queryComments, comments)
  cache.saveQueryData(queryUser, userX) // update one of the commenters' info

  const output = cache.get(queryCommentsCacheKey!)
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

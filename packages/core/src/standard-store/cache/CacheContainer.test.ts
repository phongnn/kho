import CacheContainer from "./CacheContainer"
import { NormalizedType } from "../../NormalizedType"
import { LocalQuery } from "../../Query"

afterAll(() => {
  // @ts-ignore
  NormalizedType.typeRegistry = new Map()
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

it("should read what it wrote", () => {
  const query = new LocalQuery("comment-x", { shape: [CommentType] })
  const input = [
    {
      id: "c1",
      body: "comment...",
      user: { username: "x", avatar: "http://" },
    },
    { id: "c2", body: "c2...", user: { username: "y", email: "y@xy.z" } },
  ]
  const cache = new CacheContainer()
  const cacheKey = cache.save(query, input)
  const output = cache.get(cacheKey)
  expect(output).toStrictEqual(input)
})

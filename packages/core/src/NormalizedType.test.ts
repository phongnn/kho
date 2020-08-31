import { NormalizedType } from "./NormalizedType"

it("should replace type objects by type names", () => {
  const UserType = NormalizedType.register("User", {
    keyFields: ["username"],
  })

  const CommentType = NormalizedType.register("Comment", {
    shape: { user: UserType },
  })

  // type object should be replaced with string "User"
  expect(CommentType.shape!.user).toBe("User")
})

it("should replace type objects by type names at a deep level", () => {
  const PostType = NormalizedType.register("Post")
  const ForumType = NormalizedType.register("Forum", {
    shape: {
      topics: [{ posts: [PostType] }],
    },
  })

  // type object should be replaced with string "Post"
  expect(ForumType.shape).toStrictEqual({ topics: [{ posts: ["Post"] }] })
})

// import { NormalizedType } from "./NormalizedType"

// NormalizedType.register("User", {
//   keyFields: ["username"],
//   shape: {
//     favoriteArticles: ["Article"],
//   },
// })

// it("should replace existing type names within the new type object", () => {
//   NormalizedType.register("Comment", { shape: { user: "User" } })
//   const commentType = NormalizedType.lookup("Comment")

//   // string "User" should be replaced with a type object
//   expect(commentType!.shape!.user).toBe(NormalizedType.lookup("User"))
// })

// it("should replace new type name within existing type objects", () => {
//   NormalizedType.register("Article", {
//     keyFields: ["slug"],
//     shape: {
//       author: "User",
//       comments: ["Comment"],
//     },
//   })

//   const articleType = NormalizedType.lookup("Article")
//   const userType = NormalizedType.lookup("User")

//   // ["Article"] should be replaced with the new type object
//   expect(userType!.shape!.favoriteArticles).toStrictEqual([articleType])

//   expect(articleType!.shape).toStrictEqual({
//     author: NormalizedType.lookup("User"),
//     comments: [NormalizedType.lookup("Comment")],
//   })
// })

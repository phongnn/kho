import {
  NormalizedType,
  NormalizedObjectRef,
  NormalizedObjectKey,
} from "../common"
import Selector from "./Selector"
import DataDenormalizer from "./DataDenormalizer"

afterEach(() => {
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

it("should return primitive data", () => {
  const data = "Hello, World!"
  const selector = new Selector()
  const denormalizer = new DataDenormalizer(() => null)
  const result = denormalizer.denormalize(data, selector)
  expect(result).toBe(data)
})

it("should return a typed object", () => {
  const userObj = { username: "x", email: "x@test.co", age: 30 }
  const data = new NormalizedObjectRef(UserType, new NormalizedObjectKey("x"))
  const selector = Selector.from(["username", "email", "age"])
  const denormalizer = new DataDenormalizer((type, key) => {
    return type === UserType && key === data.key ? userObj : null
  })

  const result = denormalizer.denormalize(data, selector)
  expect(result).toStrictEqual(userObj)
})

it("should return nested objects", () => {
  const userObj = { username: "x", avatar: "http://" }
  const commentObj = {
    id: "xyz",
    body: "comment goes here...",
    user: new NormalizedObjectRef(UserType, new NormalizedObjectKey("x")),
  }
  // prettier-ignore
  const data = new NormalizedObjectRef(CommentType, new NormalizedObjectKey("xyz"))
  // prettier-ignore
  const selector = Selector.from(["id", "body", ["user", ["username", "avatar"]]])
  const denormalizer = new DataDenormalizer((type, key) => {
    return type === CommentType && key === data.key
      ? commentObj
      : type === UserType && key === commentObj.user.key
      ? userObj
      : null
  })
  const result = denormalizer.denormalize(data, selector)

  expect(result).toStrictEqual({
    id: "xyz",
    body: "comment goes here...",
    user: {
      username: "x",
      avatar: "http://",
    },
  })
})

it("should return an array", () => {
  const userObjects = [
    { username: "x", email: "x@test.co", age: 30 },
    { username: "y", email: "y@test.co", avatar: "http://" },
  ]
  const data = [
    new NormalizedObjectRef(UserType, new NormalizedObjectKey("x")),
    new NormalizedObjectRef(UserType, new NormalizedObjectKey("y")),
  ]
  const selector = Selector.from(["username", "email", "age", "avatar"])
  const denormalizer = new DataDenormalizer((type, key) => {
    return type === UserType
      ? userObjects.find((u) => key.matches(u.username))
      : null
  })
  const result = denormalizer.denormalize(data, selector)
  expect(result).toStrictEqual(userObjects)
})

it("should return nested arrays", () => {
  const userObjects = [
    { username: "x", avatar: "http://", email: "x@y" },
    { username: "y" },
  ]
  const commentObjects = [
    { id: 1, body: "comment 1" },
    {
      id: 2,
      body: "comment 2",
      user: new NormalizedObjectRef(UserType, new NormalizedObjectKey("x")),
    },
    {
      id: 3,
      body: "comment 3",
      user: new NormalizedObjectRef(UserType, new NormalizedObjectKey("x")),
    },
  ]
  const articleObjects = [
    {
      slug: "a1",
      title: "blah",
      comments: [
        new NormalizedObjectRef(CommentType, new NormalizedObjectKey(1)),
        new NormalizedObjectRef(CommentType, new NormalizedObjectKey(2)),
      ],
    },
    {
      slug: "a2",
      author: new NormalizedObjectRef(UserType, new NormalizedObjectKey("y")),
      comments: [
        new NormalizedObjectRef(CommentType, new NormalizedObjectKey(3)),
      ],
    },
  ]
  const data = [
    new NormalizedObjectRef(ArticleType, new NormalizedObjectKey("a1")),
    new NormalizedObjectRef(ArticleType, new NormalizedObjectKey("a2")),
  ]
  const selector = Selector.from([
    "slug",
    "title",
    ["author", ["username"]],
    ["comments", ["id", "body", ["user", ["username", "avatar", "email"]]]],
  ])

  const denormalizer = new DataDenormalizer((type, key) => {
    return type === UserType
      ? userObjects.find((u) => key.matches(u.username))
      : type === CommentType
      ? commentObjects.find((c) => key.matches(c.id))
      : type === ArticleType
      ? articleObjects.find((a) => key.matches(a.slug))
      : null
  })
  const result = denormalizer.denormalize(data, selector)

  expect(result).toStrictEqual([
    {
      slug: "a1",
      title: "blah",
      author: null,
      comments: [
        { id: 1, body: "comment 1", user: null },
        {
          id: 2,
          body: "comment 2",
          user: { username: "x", avatar: "http://", email: "x@y" },
        },
      ],
    },
    {
      slug: "a2",
      author: { username: "y" },
      comments: [
        {
          id: 3,
          body: "comment 3",
          user: { username: "x", avatar: "http://", email: "x@y" },
        },
      ],
    },
  ])
})

it("should return an untyped object", () => {
  const userObjects = [{ username: "x", email: "x@test.co" }]
  const articleObjects = [
    { slug: "a1", title: "blah" },
    { slug: "a2", title: "blah" },
  ]
  const data = {
    author: new NormalizedObjectRef(UserType, new NormalizedObjectKey("x")),
    articles: [
      new NormalizedObjectRef(ArticleType, new NormalizedObjectKey("a1")),
      new NormalizedObjectRef(ArticleType, new NormalizedObjectKey("a2")),
    ],
    extra: {
      state: {
        ok: true,
      },
    },
    extraArray: [],
  }
  const selector = Selector.from([
    ["author", ["username", "email"]],
    ["articles", ["slug", "title"]],
    "extra", // no sub-selector
    "extraArray", // no sub-selector
  ])

  const denormalizer = new DataDenormalizer((type, key) => {
    return type === UserType
      ? userObjects.find((u) => key.matches(u.username))
      : type === ArticleType
      ? articleObjects.find((a) => key.matches(a.slug))
      : null
  })
  const result = denormalizer.denormalize(data, selector)

  expect(result).toStrictEqual({
    author: { username: "x", email: "x@test.co" },
    articles: [
      { slug: "a1", title: "blah" },
      { slug: "a2", title: "blah" },
    ],
    extra: {
      state: {
        ok: true,
      },
    },
    extraArray: [],
  })
})

it("should transform data", () => {
  const CustomerType = NormalizedType.register("Customer")
  const ProductType = NormalizedType.register("Product", {
    transform: {
      brand: (val) => val.toUpperCase(),
    },
  })
  const OrderType = NormalizedType.register("Order", {
    transform: {
      createdDate: (timestamp) => new Date(timestamp),
    },
  })

  const now = new Date()
  const productObjects = [
    { id: "p1", name: "Laptop", brand: "Dell" },
    { id: "p2", name: "Phone", brand: "Apple" },
  ]
  const customerObjects = [{ id: "x", name: "X", email: "x@test.com" }]
  const orderObjects = [
    {
      id: "Order-123",
      customer: new NormalizedObjectRef(
        CustomerType,
        new NormalizedObjectKey("x")
      ),
      createdDate: now.getTime(),
      shippingAddress: "123 High Street",
      items: [
        {
          product: new NormalizedObjectRef(
            ProductType,
            new NormalizedObjectKey("p1")
          ),
          quantity: 1,
        },
        {
          product: new NormalizedObjectRef(
            ProductType,
            new NormalizedObjectKey("p2")
          ),
          quantity: 2,
        },
      ],
    },
  ]

  const data = {
    order: new NormalizedObjectRef(
      OrderType,
      new NormalizedObjectKey("Order-123")
    ),
    extra: {
      notes: ["blah"],
    },
  }

  const selector = Selector.from([
    [
      "order",
      [
        "id",
        ["customer", ["id", "name", "email"]],
        "createdDate",
        "shippingAddress",
        ["items", [["product", ["id", "name", "brand"]], "quantity"]],
      ],
    ],
    "extra",
  ])

  const denormalizer = new DataDenormalizer((type, key) => {
    return type === CustomerType
      ? customerObjects.find((c) => key.matches(c.id))
      : type === ProductType
      ? productObjects.find((p) => key.matches(p.id))
      : type === OrderType
      ? orderObjects.find((o) => key.matches(o.id))
      : null
  })
  const result = denormalizer.denormalize(data, selector, {
    extra: (val: any) => ({
      ...val,
      notes: val.notes.map((n: string) => n.toUpperCase()),
    }),
  })

  expect(result).toStrictEqual({
    order: {
      id: "Order-123",
      customer: { id: "x", name: "X", email: "x@test.com" },
      createdDate: now, // transformed from timestamp to Date
      shippingAddress: "123 High Street",
      // brands are converted to uppercase
      items: [
        { product: { id: "p1", name: "Laptop", brand: "DELL" }, quantity: 1 },
        { product: { id: "p2", name: "Phone", brand: "APPLE" }, quantity: 2 },
      ],
    },
    extra: {
      notes: ["BLAH"], // converted to uppercase
    },
  })
})

it("should transform array", () => {
  const CustomerType = NormalizedType.register("Customer")
  const customerObjects = [{ id: "x", name: "X", email: "x@test.com" }]
  const data = [
    {
      record: {
        customer: new NormalizedObjectRef(
          CustomerType,
          new NormalizedObjectKey("x")
        ),
        notes: "blah",
      },
    },
  ]
  const selector = Selector.from([
    ["record", [["customer", ["id", "name", "email"]], "notes"]],
  ])
  const denormalizer = new DataDenormalizer((type, key) => {
    return type === CustomerType
      ? customerObjects.find((c) => key.matches(c.id))
      : null
  })

  const result = denormalizer.denormalize(data, selector, [
    { record: { notes: (val) => val.toUpperCase() } },
  ])
  expect(result).toStrictEqual([
    {
      record: {
        customer: { id: "x", name: "X", email: "x@test.com" },
        notes: "BLAH", // converted to uppercase
      },
    },
  ])
})

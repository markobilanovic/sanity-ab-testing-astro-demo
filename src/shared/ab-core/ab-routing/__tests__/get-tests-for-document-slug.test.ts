import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTestsForDocumentSlug, type AbTestRouteSource } from "../index";

const abTests: AbTestRouteSource[] = [
  {
    _id: "test-doc-1",
    id: "expA",
    variantCodes: ["a", "b"],
    referencedPosts: [{ slug: { current: "hello" } }],
  },
  {
    _id: "test-doc-2",
    id: "expB",
    variantCodes: ["c"],
    referencedPosts: [{ slug: { current: "hello" } }],
  },
  {
    _id: "test-doc-3",
    id: "expC",
    variantCodes: ["x"],
    referencedPosts: [{ slug: { current: "other" } }],
  },
];

describe("getTestsForDocumentSlug", () => {
  it("returns sorted tests scoped to the document slug", () => {
    const result = getTestsForDocumentSlug("hello", abTests, "post");

    assert.equal(result.length, 2);
    assert.deepEqual(
      result.map((test) => test.abId),
      ["expA", "expB"],
    );
  });
});

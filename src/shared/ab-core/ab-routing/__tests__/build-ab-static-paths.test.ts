import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAbStaticPaths, type AbTestRouteSource } from "../index";

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
];

describe("buildAbStaticPaths", () => {
  it("builds base and composite slugs", () => {
    const paths = buildAbStaticPaths(["hello", "hello", ""], abTests, "post");
    const slugs = new Set(paths.map((path) => path.params.slug));

    assert.deepEqual(slugs, new Set([
      "hello",
      "hello--expA-a--expB-c",
      "hello--expA-b--expB-c",
    ]));

    const composite = paths.find(
      (path) => path.params.slug === "hello--expA-a--expB-c",
    );
    assert.ok(composite);
    assert.deepEqual(composite.props.contexts, [
      { abTestDocId: "test-doc-1", variantCode: "a" },
      { abTestDocId: "test-doc-2", variantCode: "c" },
    ]);
  });
});

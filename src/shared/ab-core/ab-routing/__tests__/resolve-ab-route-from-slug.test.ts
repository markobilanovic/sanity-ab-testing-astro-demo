import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAbRouteFromSlug, type AbTestRouteSource } from "../index";

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

describe("resolveAbRouteFromSlug", () => {
  it("returns base contexts for a canonical slug", () => {
    assert.deepEqual(resolveAbRouteFromSlug("hello", abTests, "post"), {
      documentSlug: "hello",
      documentType: "post",
      contexts: [],
    });
  });

  it("returns ordered contexts for a composite slug", () => {
    const result = resolveAbRouteFromSlug("hello--expB-c--expA-b", abTests, "post");

    assert.deepEqual(result, {
      documentSlug: "hello",
      documentType: "post",
      contexts: [
        { abTestDocId: "test-doc-1", variantCode: "b" },
        { abTestDocId: "test-doc-2", variantCode: "c" },
      ],
    });
  });

  it("rejects duplicate or unknown assignments", () => {
    assert.equal(
      resolveAbRouteFromSlug("hello--expA-a--expA-b", abTests, "post"),
      null,
    );
    assert.equal(
      resolveAbRouteFromSlug("hello--expA-z", abTests, "post"),
      null,
    );
    assert.equal(
      resolveAbRouteFromSlug("hello--missing-a", abTests, "post"),
      null,
    );
  });
});

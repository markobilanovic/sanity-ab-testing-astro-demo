import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializeCompositeSlug } from "../index";

describe("serializeCompositeSlug", () => {
  it("normalizes, sorts, and dedupes assignments", () => {
    assert.equal(
      serializeCompositeSlug("hello", [
        { abId: "expB", variantCode: "c" },
        { abId: "expA", variantCode: "a" },
        { abId: "expB", variantCode: "d" },
      ]),
      "hello--expA-a--expB-c",
    );
  });
});

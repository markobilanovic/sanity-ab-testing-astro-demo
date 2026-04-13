import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { orderAndDedupeAbRouteContexts } from "../index";

describe("orderAndDedupeAbRouteContexts", () => {
  it("dedupes, filters, and orders contexts by known tests", () => {
    const ordered = orderAndDedupeAbRouteContexts(
      [
        { abTestDocId: "test-doc-2", variantCode: "c" },
        { abTestDocId: "test-doc-1", variantCode: "a" },
        { abTestDocId: "test-doc-2", variantCode: "b" },
        { abTestDocId: "test-doc-3", variantCode: "x" },
      ],
      [
        { abId: "expA", abTestDocId: "test-doc-1", variantCodes: ["a"] },
        { abId: "expB", abTestDocId: "test-doc-2", variantCodes: ["c"] },
      ],
    );

    assert.deepEqual(ordered, [
      { abTestDocId: "test-doc-1", variantCode: "a" },
      { abTestDocId: "test-doc-2", variantCode: "c" },
    ]);
  });
});

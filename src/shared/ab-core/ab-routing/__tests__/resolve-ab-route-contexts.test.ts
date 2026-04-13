import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAbRouteContexts } from "../index";

describe("resolveAbRouteContexts", () => {
  it("filters invalid contexts", () => {
    const contexts = resolveAbRouteContexts({
      contexts: [
        { abTestDocId: "test-doc-1", variantCode: "a" },
        { abTestDocId: "", variantCode: "b" },
        { abTestDocId: "test-doc-2" },
        null,
      ],
    });

    assert.deepEqual(contexts, [
      { abTestDocId: "test-doc-1", variantCode: "a" },
    ]);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toAbRouteContexts } from "../index";

describe("toAbRouteContexts", () => {
  it("maps experiments to contexts", () => {
    const result = toAbRouteContexts([
      { abId: "expA", abTestDocId: "test-doc-1", variantCode: "a" },
    ]);

    assert.deepEqual(result, [
      { abTestDocId: "test-doc-1", variantCode: "a" },
    ]);
  });
});

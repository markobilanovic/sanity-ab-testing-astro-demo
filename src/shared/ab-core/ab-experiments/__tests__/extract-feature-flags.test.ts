import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFeatureFlags } from "../index";

describe("extractFeatureFlags", () => {
  it("returns only boolean/string/undefined flags", () => {
    const result = extractFeatureFlags({
      featureFlags: {
        enabled: true,
        variant: "a",
        off: false,
        count: 3,
        nested: { a: 1 },
      },
    });

    assert.deepEqual(result, {
      enabled: true,
      variant: "a",
      off: false,
    });
  });

  it("returns empty object for non-object values", () => {
    assert.deepEqual(extractFeatureFlags(null), {});
    assert.deepEqual(extractFeatureFlags("nope"), {});
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getActiveFeatureFlags } from "../index";

describe("getActiveFeatureFlags", () => {
  it("filters to active flags", () => {
    const result = getActiveFeatureFlags({
      enabled: true,
      disabled: false,
      empty: "",
      variant: "a",
    });

    assert.deepEqual(result, {
      enabled: true,
      variant: "a",
    });
  });
});

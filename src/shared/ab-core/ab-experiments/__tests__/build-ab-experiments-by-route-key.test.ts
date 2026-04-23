import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAbExperimentsByRouteKey } from "../index.js";
import type { AbTestRouteSource } from "../../ab-routing/index.js";

describe("buildAbExperimentsByRouteKey", () => {
  it("maps assigned variants to route keys", () => {
    const abTests: AbTestRouteSource[] = [
      {
        _id: "test-doc-1",
        id: "expA",
        variantCodes: ["a", "b"],
        referencedPosts: [{ slug: { current: "hello" } }],
        referencedPages: [{ slug: { current: "landing" } }],
      },
    ];

    const result = buildAbExperimentsByRouteKey(abTests, { expA: "a" });

    assert.deepEqual(result["post:hello"], [
      { abId: "expA", abTestDocId: "test-doc-1", variantCode: "a" },
    ]);
    assert.deepEqual(result["page:landing"], [
      { abId: "expA", abTestDocId: "test-doc-1", variantCode: "a" },
    ]);
  });

  it("ignores invalid or unassigned variants", () => {
    const abTests: AbTestRouteSource[] = [
      {
        _id: "test-doc-1",
        id: "expA",
        variantCodes: ["a"],
        referencedPosts: [{ slug: { current: "hello" } }],
      },
    ];

    assert.deepEqual(buildAbExperimentsByRouteKey(abTests, { expA: "b" }), {});
    assert.deepEqual(buildAbExperimentsByRouteKey(abTests, { expA: true }), {});
  });
});

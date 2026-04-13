import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAbVariants } from "../index";

describe("applyAbVariants", () => {
  it("applies variant overrides recursively", () => {
    const value = {
      title: "Base",
      showAbVariant: true,
      abTestRef: { _ref: "test-doc-1" },
      abVariants: [
        { variantCode: "a", variant: { title: "Variant A" } },
      ],
      nested: {
        label: "Nested Base",
        showAbVariant: true,
        abTestRef: { _ref: "test-doc-1" },
        abVariants: [
          { variantCode: "a", variant: { label: "Nested A" } },
        ],
      },
    };

    const result = applyAbVariants(value, {
      abTestDocId: "test-doc-1",
      variantCode: "a",
    });

    assert.equal(result.title, "Variant A");
    assert.equal(result.nested.label, "Nested A");
  });
});

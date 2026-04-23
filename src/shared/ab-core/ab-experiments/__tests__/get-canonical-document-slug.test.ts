import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCanonicalDocumentSlug } from "../index.js";

describe("getCanonicalDocumentSlug", () => {
  it("returns the base document slug", () => {
    assert.equal(getCanonicalDocumentSlug("hello--expA-a"), "hello");
  });

  it("returns null for invalid slugs", () => {
    assert.equal(getCanonicalDocumentSlug(""), null);
    assert.equal(getCanonicalDocumentSlug("   "), null);
  });
});

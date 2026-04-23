import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRequestedAbRoute } from "../index.js";

describe("getRequestedAbRoute", () => {
  it("detects post routes", () => {
    assert.deepEqual(getRequestedAbRoute("/post/hello"), {
      documentType: "post",
      requestedSlug: "hello",
    });
  });

  it("detects page routes", () => {
    assert.deepEqual(getRequestedAbRoute("/landing"), {
      documentType: "page",
      requestedSlug: "landing",
    });
  });

  it("rejects reserved root segments", () => {
    assert.equal(getRequestedAbRoute("/api"), null);
    assert.equal(getRequestedAbRoute("/favicon.ico"), null);
  });
});

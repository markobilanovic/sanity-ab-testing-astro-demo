import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRouteKey } from "../index";

describe("buildRouteKey", () => {
  it("builds a stable key", () => {
    assert.equal(buildRouteKey("post", "hello"), "post:hello");
  });
});

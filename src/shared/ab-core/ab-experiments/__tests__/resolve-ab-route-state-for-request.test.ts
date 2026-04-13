import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAbRouteStateForRequest } from "../index";

describe("resolveAbRouteStateForRequest", () => {
  it("prefers route props and merges contexts", () => {
    const result = resolveAbRouteStateForRequest({
      routeSlug: "hello",
      routeProps: {
        documentSlug: "props-slug",
        documentType: "page",
        contexts: [{ abTestDocId: "test-doc-1", variantCode: "a" }],
      },
      rewrittenDocumentSlug: "rewritten",
      defaultDocumentType: "post",
      abExperimentsByRouteKey: {
        "page:props-slug": [
          { abId: "expB", abTestDocId: "test-doc-2", variantCode: "b" },
        ],
      },
    });

    assert.equal(result.documentSlug, "props-slug");
    assert.equal(result.documentType, "page");
    assert.equal(result.shouldResolveFromRouteSlug, false);
    assert.deepEqual(result.contexts, [
      { abTestDocId: "test-doc-1", variantCode: "a" },
      { abTestDocId: "test-doc-2", variantCode: "b" },
    ]);
  });

  it("falls back to route slug when no props or rewrite", () => {
    const result = resolveAbRouteStateForRequest({
      routeSlug: "hello",
      defaultDocumentType: "post",
    });

    assert.equal(result.documentSlug, "hello");
    assert.equal(result.documentType, "post");
    assert.equal(result.shouldResolveFromRouteSlug, true);
  });
});

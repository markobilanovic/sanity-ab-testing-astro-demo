import type { AbRouteContext, AbRouteTest } from "./types.js";
import { normalizeNonEmptyString } from "./normalize-non-empty-string.js";

export function orderAndDedupeAbRouteContexts(
  contexts: AbRouteContext[],
  knownTests: AbRouteTest[] = [],
): AbRouteContext[] {
  const knownAbTestDocIds = new Set(knownTests.map((test) => test.abTestDocId));
  const abTestDocIdOrder = new Map(
    knownTests.map((test, index) => [test.abTestDocId, index] as const),
  );

  const dedupedContextsByTest = new Map<string, AbRouteContext>();
  for (const context of contexts) {
    if (!context || typeof context !== "object") {
      continue;
    }

    const abTestDocId = normalizeNonEmptyString(context.abTestDocId);
    const variantCode = normalizeNonEmptyString(context.variantCode);
    if (!abTestDocId || !variantCode) {
      continue;
    }

    if (knownAbTestDocIds.size > 0 && !knownAbTestDocIds.has(abTestDocId)) {
      continue;
    }

    if (!dedupedContextsByTest.has(abTestDocId)) {
      dedupedContextsByTest.set(abTestDocId, { abTestDocId, variantCode });
    }
  }

  return [...dedupedContextsByTest.values()].sort((left, right) => {
    const leftOrder = abTestDocIdOrder.get(left.abTestDocId);
    const rightOrder = abTestDocIdOrder.get(right.abTestDocId);

    if (typeof leftOrder === "number" && typeof rightOrder === "number") {
      return leftOrder - rightOrder;
    }
    if (typeof leftOrder === "number") {
      return -1;
    }
    if (typeof rightOrder === "number") {
      return 1;
    }

    return left.abTestDocId.localeCompare(right.abTestDocId);
  });
}

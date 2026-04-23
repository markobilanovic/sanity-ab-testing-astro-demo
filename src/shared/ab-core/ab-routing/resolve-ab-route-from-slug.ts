import {
  COMPOSITE_PAIR_SEPARATOR,
  COMPOSITE_SEGMENT_SEPARATOR,
} from "./constants.js";
import { getTestsForDocumentSlug } from "./get-tests-for-document-slug.js";
import { normalizeNonEmptyString } from "./normalize-non-empty-string.js";
import { orderAndDedupeAbRouteContexts } from "./order-and-dedupe-ab-route-contexts.js";
import type {
  AbDocumentType,
  AbRouteContext,
  AbRouteProps,
  AbTestRouteSource,
} from "./types.js";

export function resolveAbRouteFromSlug(
  routeSlug: string,
  abTests: AbTestRouteSource[],
  documentType: AbDocumentType = "post",
): AbRouteProps | null {
  const normalizedRouteSlug = normalizeNonEmptyString(routeSlug);
  if (!normalizedRouteSlug) {
    return null;
  }

  const routeParts = normalizedRouteSlug.split(COMPOSITE_SEGMENT_SEPARATOR);
  const normalizedDocumentSlug = normalizeNonEmptyString(routeParts[0]);
  if (!normalizedDocumentSlug) {
    return null;
  }

  const routeTests = getTestsForDocumentSlug(
    normalizedDocumentSlug,
    abTests,
    documentType,
  );
  if (routeParts.length === 1) {
    return {
      documentSlug: normalizedDocumentSlug,
      documentType,
      contexts: [],
    };
  }

  const remainingParts = routeParts.slice(1);
  const seenAbIds = new Set<string>();
  const contexts: AbRouteContext[] = [];

  for (const routePart of remainingParts) {
    const normalizedPart = normalizeNonEmptyString(routePart);
    if (!normalizedPart) {
      return null;
    }

    const matchingTest = routeTests.find((test) =>
      normalizedPart.startsWith(`${test.abId}${COMPOSITE_PAIR_SEPARATOR}`),
    );
    if (!matchingTest) {
      return null;
    }

    if (seenAbIds.has(matchingTest.abId)) {
      return null;
    }

    const variantCode = normalizeNonEmptyString(
      normalizedPart.slice(
        matchingTest.abId.length + COMPOSITE_PAIR_SEPARATOR.length,
      ),
    );
    if (!variantCode || !matchingTest.variantCodes.includes(variantCode)) {
      return null;
    }

    seenAbIds.add(matchingTest.abId);
    contexts.push({
      abTestDocId: matchingTest.abTestDocId,
      variantCode,
    });
  }

  const orderedContexts = orderAndDedupeAbRouteContexts(contexts, routeTests);
  if (orderedContexts.length !== contexts.length) {
    return null;
  }

  return {
    documentSlug: normalizedDocumentSlug,
    documentType,
    contexts: orderedContexts,
  };
}

import type { AbDocumentType, AbTestRouteSource } from "../ab-routing";
import { normalizeNonEmptyString, normalizeNonEmptyStrings } from "../ab-routing";
import { buildRouteKey } from "./build-route-key";
import type { AbFeatureFlags, AbMiddlewareExperiment } from "./types";

const AB_DOCUMENT_TYPES: AbDocumentType[] = ["post", "page"];
const AB_TEST_REFERENCE_FIELD_BY_TYPE: Record<
  AbDocumentType,
  keyof AbTestRouteSource
> = {
  post: "referencedPosts",
  page: "referencedPages",
};

export function buildAbExperimentsByRouteKey(
  abTests: AbTestRouteSource[],
  featureFlags: AbFeatureFlags,
): Record<string, AbMiddlewareExperiment[]> {
  const byRouteKey: Record<string, AbMiddlewareExperiment[]> = {};

  for (const abTest of abTests) {
    const abTestDocId = normalizeNonEmptyString(abTest._id);
    const abId = normalizeNonEmptyString(abTest.id);
    if (!abTestDocId || !abId) {
      continue;
    }

    const assignedVariant = featureFlags[abId];
    if (typeof assignedVariant !== "string") {
      continue;
    }

    const variantCodes = new Set(normalizeNonEmptyStrings(abTest.variantCodes));
    if (!variantCodes.has(assignedVariant)) {
      continue;
    }

    for (const documentType of AB_DOCUMENT_TYPES) {
      const referenceField = AB_TEST_REFERENCE_FIELD_BY_TYPE[documentType];
      const referencedDocumentSlugs = normalizeNonEmptyStrings(
        ((abTest[referenceField] as Array<{ slug?: { current?: string } }> | undefined) ?? [])
          .map((document) => document.slug?.current),
      );
      if (referencedDocumentSlugs.length === 0) {
        continue;
      }

      for (const documentSlug of referencedDocumentSlugs) {
        const routeKey = buildRouteKey(documentType, documentSlug);
        byRouteKey[routeKey] ??= [];
        byRouteKey[routeKey].push({
          abId,
          abTestDocId,
          variantCode: assignedVariant,
        });
      }
    }
  }

  return byRouteKey;
}

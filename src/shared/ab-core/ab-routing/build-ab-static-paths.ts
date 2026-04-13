import { buildCartesianCombinations } from "./build-cartesian-combinations";
import { getTestsForDocumentSlug } from "./get-tests-for-document-slug";
import { normalizeNonEmptyString } from "./normalize-non-empty-string";
import { serializeCompositeSlug } from "./serialize-composite-slug";
import type { AbDocumentType, AbRouteProps, AbTestRouteSource } from "./types";

export function buildAbStaticPaths(
  documentSlugs: string[],
  abTests: AbTestRouteSource[],
  documentType: AbDocumentType = "post",
): Array<{ params: { slug: string }; props: AbRouteProps }> {
  const staticPaths: Array<{ params: { slug: string }; props: AbRouteProps }> = [];
  const seenRouteSlugs = new Set<string>();

  for (const documentSlug of documentSlugs) {
    const normalizedDocumentSlug = normalizeNonEmptyString(documentSlug);
    if (!normalizedDocumentSlug || seenRouteSlugs.has(normalizedDocumentSlug)) {
      continue;
    }

    seenRouteSlugs.add(normalizedDocumentSlug);
    staticPaths.push({
      params: { slug: normalizedDocumentSlug },
      props: {
        documentSlug: normalizedDocumentSlug,
        documentType,
        contexts: [],
      },
    });

    const routeTests = getTestsForDocumentSlug(
      normalizedDocumentSlug,
      abTests,
      documentType,
    );
    const routeCombinations = buildCartesianCombinations(routeTests);

    for (const routeCombination of routeCombinations) {
      const routeSlug = serializeCompositeSlug(
        normalizedDocumentSlug,
        routeCombination.segments,
      );
      if (seenRouteSlugs.has(routeSlug)) {
        continue;
      }

      seenRouteSlugs.add(routeSlug);
      staticPaths.push({
        params: { slug: routeSlug },
        props: {
          documentSlug: normalizedDocumentSlug,
          documentType,
          contexts: routeCombination.contexts,
        },
      });
    }
  }

  return staticPaths;
}

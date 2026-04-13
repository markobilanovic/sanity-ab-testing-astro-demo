import { AB_TEST_REFERENCES_BY_DOCUMENT_TYPE } from "./constants";
import { normalizeNonEmptyString } from "./normalize-non-empty-string";
import { normalizeNonEmptyStrings } from "./normalize-non-empty-strings";
import type { AbDocumentType, AbRouteTest, AbTestRouteSource } from "./types";

export function getTestsForDocumentSlug(
  documentSlug: string,
  abTests: AbTestRouteSource[],
  documentType: AbDocumentType = "post",
): AbRouteTest[] {
  const normalizedDocumentSlug = normalizeNonEmptyString(documentSlug);
  if (!normalizedDocumentSlug) {
    return [];
  }

  const testsForPost: AbRouteTest[] = [];
  for (const abTest of abTests) {
    const abTestDocId = normalizeNonEmptyString(abTest._id);
    const abId = normalizeNonEmptyString(abTest.id);
    if (!abTestDocId || !abId) {
      continue;
    }

    const variantCodes = normalizeNonEmptyStrings(abTest.variantCodes);
    if (variantCodes.length === 0) {
      continue;
    }

    const referenceField = AB_TEST_REFERENCES_BY_DOCUMENT_TYPE[documentType];
    const referencedDocumentSlugs = new Set(
      normalizeNonEmptyStrings(
        ((abTest[referenceField] as Array<{ slug?: { current?: string } }> | undefined) ?? [])
          .map((document) => document.slug?.current),
      ),
    );
    if (!referencedDocumentSlugs.has(normalizedDocumentSlug)) {
      continue;
    }

    testsForPost.push({
      abId,
      abTestDocId,
      variantCodes,
    });
  }

  return testsForPost.sort((left, right) => left.abId.localeCompare(right.abId));
}

import { COMPOSITE_PAIR_SEPARATOR, COMPOSITE_SEGMENT_SEPARATOR } from "./constants";
import { normalizeNonEmptyString } from "./normalize-non-empty-string";

export function serializeCompositeSlug(
  documentSlug: string,
  assignments: Array<{ abId: string; variantCode: string }>,
): string {
  const normalizedDocumentSlug = normalizeNonEmptyString(documentSlug);
  if (!normalizedDocumentSlug) {
    return "";
  }

  const canonicalAssignments = assignments
    .map((assignment) => ({
      abId: normalizeNonEmptyString(assignment.abId),
      variantCode: normalizeNonEmptyString(assignment.variantCode),
    }))
    .filter(
      (
        assignment,
      ): assignment is {
        abId: string;
        variantCode: string;
      } => Boolean(assignment.abId && assignment.variantCode),
    )
    .sort((left, right) => left.abId.localeCompare(right.abId));

  if (canonicalAssignments.length === 0) {
    return normalizedDocumentSlug;
  }

  const seenAbIds = new Set<string>();
  const uniqueAssignments: Array<{ abId: string; variantCode: string }> = [];
  for (const assignment of canonicalAssignments) {
    if (seenAbIds.has(assignment.abId)) {
      continue;
    }
    seenAbIds.add(assignment.abId);
    uniqueAssignments.push(assignment);
  }

  const routeSegments = uniqueAssignments.map(
    ({ abId, variantCode }) => `${abId}${COMPOSITE_PAIR_SEPARATOR}${variantCode}`,
  );
  return `${normalizedDocumentSlug}${COMPOSITE_SEGMENT_SEPARATOR}${routeSegments.join(COMPOSITE_SEGMENT_SEPARATOR)}`;
}

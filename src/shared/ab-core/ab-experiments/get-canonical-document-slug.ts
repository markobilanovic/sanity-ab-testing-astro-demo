import { normalizeNonEmptyString } from "../ab-routing/index.js";

export function getCanonicalDocumentSlug(routeSlug: string): string | null {
  const normalizedRouteSlug = normalizeNonEmptyString(routeSlug);
  if (!normalizedRouteSlug) {
    return null;
  }

  const canonicalDocumentSlug = normalizedRouteSlug.split("--")[0];
  return normalizeNonEmptyString(canonicalDocumentSlug);
}

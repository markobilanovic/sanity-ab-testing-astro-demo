import { normalizeNonEmptyString } from "../ab-routing";

export function getCanonicalDocumentSlug(routeSlug: string): string | null {
  const normalizedRouteSlug = normalizeNonEmptyString(routeSlug);
  if (!normalizedRouteSlug) {
    return null;
  }

  const canonicalDocumentSlug = normalizedRouteSlug.split("--")[0];
  return normalizeNonEmptyString(canonicalDocumentSlug);
}

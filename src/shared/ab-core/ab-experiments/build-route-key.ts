import type { AbDocumentType } from "../ab-routing/index.js";

export function buildRouteKey(documentType: AbDocumentType, slug: string): string {
  return `${documentType}:${slug}`;
}

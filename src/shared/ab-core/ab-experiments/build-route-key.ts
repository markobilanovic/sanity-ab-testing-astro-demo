import type { AbDocumentType } from "../ab-routing";

export function buildRouteKey(documentType: AbDocumentType, slug: string): string {
  return `${documentType}:${slug}`;
}

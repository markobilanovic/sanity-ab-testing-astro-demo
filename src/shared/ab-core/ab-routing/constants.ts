import type { AbDocumentType, AbTestRouteSource } from "./types.js";

export const AB_TOGGLE_FIELD_NAME = "showAbVariant";
export const AB_VARIANTS_FIELD_NAME = "abVariants";
export const AB_TEST_REF_FIELD_NAME = "abTestRef";
export const COMPOSITE_SEGMENT_SEPARATOR = "--";
export const COMPOSITE_PAIR_SEPARATOR = "-";

export const AB_TEST_REFERENCES_BY_DOCUMENT_TYPE: Record<
  AbDocumentType,
  keyof AbTestRouteSource
> = {
  post: "referencedPosts",
  page: "referencedPages",
};

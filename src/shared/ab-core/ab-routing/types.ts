export type AbTestRouteSource = {
  _id?: string;
  id?: string;
  variantCodes?: string[];
  referencedPosts?: Array<{ slug?: { current?: string } }>;
  referencedPages?: Array<{ slug?: { current?: string } }>;
};

export type AbRouteProps = {
  documentSlug: string;
  documentType?: AbDocumentType;
  contexts: AbRouteContext[];
};

export type AbRouteContext = {
  abTestDocId: string;
  variantCode: string;
};

export type AbDocumentType = "post" | "page";

export type AbRouteTest = {
  abId: string;
  abTestDocId: string;
  variantCodes: string[];
};

export type AbTestDocument = {
  _id: string;
  name?: string;
  variantCodes?: string[];
};

export type AbVariantItem = {
  _key: string;
  _type: string;
  abTestName: string;
  variantCode: string;
  variant: Record<string, unknown>;
};

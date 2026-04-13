export type AbFeatureFlags = Record<string, string | boolean | undefined>;

export type AbMiddlewareExperiment = {
  abId: string;
  abTestDocId: string;
  variantCode: string;
};

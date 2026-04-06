/// <reference types="astro/client" />
/// <reference types="@sanity/astro/module" />

interface ImportMetaEnv {
  readonly POSTHOG_API_KEY?: string;
  readonly POSTHOG_HOST?: string;
}

type AbMiddlewareExperiment = {
  abId: string;
  abTestDocId: string;
  variantCode: string;
};

declare namespace App {
  interface Locals {
    posthogDistinctId?: string;
    abExperimentsByPostSlug?: Record<string, AbMiddlewareExperiment[]>;
  }
}

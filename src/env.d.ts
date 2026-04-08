/// <reference types="astro/client" />
/// <reference types="@sanity/astro/module" />

interface ImportMetaEnv {
  readonly POSTHOG_API_KEY?: string;
  readonly POSTHOG_HOST?: string;
  readonly ASTRO_REVALIDATE_SECRET?: string;
  readonly SANITY_STUDIO_POSTHOG_HOST?: string;
  readonly SANITY_STUDIO_POSTHOG_PROJECT_ID?: string;
  readonly SANITY_STUDIO_POSTHOG_PERSONAL_API_KEY?: string;
  readonly SANITY_STUDIO_ASTRO_REVALIDATE_SECRET?: string;
}

type AbMiddlewareExperiment =
  import("./sanity/lib/ab-experiments").AbMiddlewareExperiment;
type AbDocumentType = import("./sanity/lib/ab-routing").AbDocumentType;

declare namespace App {
  interface Locals {
    posthogDistinctId?: string;
    abExperimentsByRouteKey?: Record<string, AbMiddlewareExperiment[]>;
    rewrittenDocumentSlug?: string;
    rewrittenDocumentType?: AbDocumentType;
    rewrittenExperiment?: AbMiddlewareExperiment;
  }
}

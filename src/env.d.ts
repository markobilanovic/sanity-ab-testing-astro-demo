/// <reference types="astro/client" />
/// <reference types="@sanity/astro/module" />

import type { AbMiddlewareExperiment } from "./sanity/lib/ab-experiments";
import type { AbDocumentType } from "./sanity/lib/ab-routing";

interface ImportMetaEnv {
  readonly POSTHOG_API_KEY?: string;
  readonly POSTHOG_HOST?: string;
  readonly ASTRO_REVALIDATE_SECRET?: string;
  readonly SANITY_STUDIO_POSTHOG_HOST?: string;
  readonly SANITY_STUDIO_POSTHOG_PROJECT_ID?: string;
  readonly SANITY_STUDIO_POSTHOG_PERSONAL_API_KEY?: string;
  readonly SANITY_STUDIO_ASTRO_REVALIDATE_SECRET?: string;
}

declare namespace App {
  interface Locals {
    posthogDistinctId?: string;
    abExperimentsByRouteKey?: Record<string, AbMiddlewareExperiment[]>;
    rewrittenDocumentSlug?: string;
    rewrittenDocumentType?: AbDocumentType;
    rewrittenExperiment?: AbMiddlewareExperiment;
  }
}

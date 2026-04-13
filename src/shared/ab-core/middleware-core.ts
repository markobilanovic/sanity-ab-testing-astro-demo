import type { AbTestRouteSource, AbDocumentType } from "./ab-routing";
import { serializeCompositeSlug } from "./ab-routing";
import type { AbFeatureFlags, AbMiddlewareExperiment } from "./ab-experiments";
import {
  buildAbExperimentsByRouteKey,
  getCanonicalDocumentSlug,
  getRequestedAbRoute,
} from "./ab-experiments";

export type AbRewriteDecision = {
  rewrittenPath: string | null;
  canonicalDocumentSlug?: string;
  documentType?: AbDocumentType;
  experiments?: AbMiddlewareExperiment[];
};

export function decideAbRewrite({
  pathname,
  abTests,
  featureFlags,
  abExperimentsByRouteKey,
}: {
  pathname: string;
  abTests: AbTestRouteSource[];
  featureFlags: AbFeatureFlags;
  abExperimentsByRouteKey?: Record<string, AbMiddlewareExperiment[]>;
}): AbRewriteDecision {
  const requestedRoute = getRequestedAbRoute(pathname);
  if (!requestedRoute) {
    return { rewrittenPath: null };
  }

  const canonicalDocumentSlug = getCanonicalDocumentSlug(requestedRoute.requestedSlug);
  if (!canonicalDocumentSlug) {
    return { rewrittenPath: null };
  }

  const experimentsByRouteKey =
    abExperimentsByRouteKey ??
    buildAbExperimentsByRouteKey(abTests, featureFlags);
  const routeKey = `${requestedRoute.documentType}:${canonicalDocumentSlug}`;
  const assignedExperiments = experimentsByRouteKey[routeKey] ?? [];
  if (assignedExperiments.length === 0) {
    return {
      rewrittenPath: null,
      canonicalDocumentSlug,
      documentType: requestedRoute.documentType,
      experiments: [],
    };
  }

  const rewrittenSlug = serializeCompositeSlug(
    canonicalDocumentSlug,
    assignedExperiments.map(({ abId, variantCode }) => ({
      abId,
      variantCode,
    })),
  );
  if (!rewrittenSlug || rewrittenSlug === requestedRoute.requestedSlug) {
    return {
      rewrittenPath: null,
      canonicalDocumentSlug,
      documentType: requestedRoute.documentType,
      experiments: assignedExperiments,
    };
  }

  const encodedSlug = encodeURIComponent(rewrittenSlug);
  const rewrittenPath =
    requestedRoute.documentType === "post" ? `/post/${encodedSlug}` : `/${encodedSlug}`;
  if (rewrittenPath === pathname) {
    return {
      rewrittenPath: null,
      canonicalDocumentSlug,
      documentType: requestedRoute.documentType,
      experiments: assignedExperiments,
    };
  }

  return {
    rewrittenPath,
    canonicalDocumentSlug,
    documentType: requestedRoute.documentType,
    experiments: assignedExperiments,
  };
}

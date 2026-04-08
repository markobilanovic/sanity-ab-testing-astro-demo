import { defineMiddleware } from "astro:middleware";
import { PostHog } from "posthog-node";
import {
  AB_TEST_VARIANT_ROUTES_QUERY,
  serializeCompositeSlug,
  type AbTestRouteSource,
} from "./sanity/lib/ab-routing";
import {
  buildAbExperimentsByRouteKey,
  extractFeatureFlags,
  getActiveFeatureFlags,
  getCanonicalDocumentSlug,
  getRequestedAbRoute,
} from "./sanity/lib/ab-experiments";
import { loadQuery } from "./sanity/lib/load-query";

const AB_TEST_CACHE_TTL_MS = 60_000;
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const DISTINCT_ID_COOKIE_NAME = "ph_distinct_id";

let posthogClient: PostHog | null = null;
let abTestCache:
  | {
      fetchedAt: number;
      tests: AbTestRouteSource[];
    }
  | null = null;

function getPosthogClient(): PostHog | null {
  const apiKey = import.meta.env.POSTHOG_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(apiKey, {
      host: import.meta.env.POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST,
    });
  }

  return posthogClient;
}

async function getAbTests(): Promise<AbTestRouteSource[]> {
  const now = Date.now();
  if (abTestCache && now - abTestCache.fetchedAt <= AB_TEST_CACHE_TTL_MS) {
    return abTestCache.tests;
  }

  const result = await loadQuery<AbTestRouteSource[]>({
    query: AB_TEST_VARIANT_ROUTES_QUERY,
  });

  const tests = Array.isArray(result.data) ? result.data : [];
  abTestCache = {
    fetchedAt: now,
    tests,
  };
  return tests;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const client = getPosthogClient();
  if (!client) {
    context.locals.abExperimentsByRouteKey = {};
    return next();
  }

  const existingDistinctId = context.cookies.get(DISTINCT_ID_COOKIE_NAME)?.value;
  const distinctId = existingDistinctId ?? crypto.randomUUID();
  context.locals.posthogDistinctId = distinctId;

  if (!existingDistinctId) {
    context.cookies.set(DISTINCT_ID_COOKIE_NAME, distinctId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: context.url.protocol === "https:",
    });
  }

  try {
    const [abTests, posthogFlags] = await Promise.all([
      getAbTests(),
      client.getAllFlagsAndPayloads(distinctId),
    ]);

    const featureFlags = extractFeatureFlags(posthogFlags);
    const activeFeatureFlags = getActiveFeatureFlags(featureFlags);
    console.info("[middleware][posthog] active feature flags", {
      path: context.url.pathname,
      distinctId,
      activeFeatureFlags,
    });
    context.locals.abExperimentsByRouteKey = buildAbExperimentsByRouteKey(
      abTests,
      featureFlags,
    );

    const requestedRoute = getRequestedAbRoute(context.url.pathname);
    if (!requestedRoute) {
      return next();
    }

    const canonicalDocumentSlug = getCanonicalDocumentSlug(requestedRoute.requestedSlug);
    if (!canonicalDocumentSlug) {
      return next();
    }

    const routeKey = `${requestedRoute.documentType}:${canonicalDocumentSlug}`;
    const assignedExperiments =
      context.locals.abExperimentsByRouteKey[routeKey] ?? [];
    if (assignedExperiments.length === 0) {
      return next();
    }

    const rewrittenSlug = serializeCompositeSlug(
      canonicalDocumentSlug,
      assignedExperiments.map(({ abId, variantCode }) => ({
        abId,
        variantCode,
      })),
    );
    if (!rewrittenSlug || rewrittenSlug === requestedRoute.requestedSlug) {
      return next();
    }

    const encodedSlug = encodeURIComponent(rewrittenSlug);
    const rewrittenPath =
      requestedRoute.documentType === "post" ? `/post/${encodedSlug}` : `/${encodedSlug}`;
    if (rewrittenPath === context.url.pathname) {
      return next();
    }

    context.locals.rewrittenDocumentSlug = canonicalDocumentSlug;
    context.locals.rewrittenDocumentType = requestedRoute.documentType;

    const rewrittenUrl = new URL(context.url);
    rewrittenUrl.pathname = rewrittenPath;

    console.info("[middleware][posthog] rewriting route", {
      from: context.url.pathname,
      to: rewrittenPath,
      documentType: requestedRoute.documentType,
      distinctId,
      experiments: assignedExperiments,
    });

    return context.rewrite(rewrittenUrl);
  } catch {
    context.locals.abExperimentsByRouteKey = {};
  }

  return next();
});

import { defineMiddleware } from "astro:middleware";
import { PostHog } from "posthog-node";
import {
  AB_TEST_VARIANT_ROUTES_QUERY,
  type AbTestRouteSource,
} from "./sanity/lib/ab-routing";
import {
  buildAbExperimentsByRouteKey,
  extractFeatureFlags,
  getActiveFeatureFlags,
} from "./sanity/lib/ab-experiments";
import { decideAbRewrite } from "./shared/ab-core/middleware-core";
import { loadQuery } from "./sanity/lib/load-query";

const AB_TEST_CACHE_TTL_MS = 60_000;
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const DISTINCT_ID_COOKIE_NAME = "ph_distinct_id";
const EDGE_MIDDLEWARE_HEADER = "x-ab-edge-middleware";
const EDGE_DISTINCT_ID_HEADER = "x-ab-distinct-id";

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
  const runningOnVercel = Boolean(process.env.VERCEL);
  if (runningOnVercel) {
    context.locals.abExperimentsByRouteKey = {};
    return next();
  }

  const handledByEdgeMiddleware =
    context.request.headers.get(EDGE_MIDDLEWARE_HEADER) === "1";
  if (handledByEdgeMiddleware) {
    context.locals.posthogDistinctId =
      context.request.headers.get(EDGE_DISTINCT_ID_HEADER) ?? undefined;
    context.locals.abExperimentsByRouteKey = {};
    return next();
  }

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
    const abExperimentsByRouteKey = buildAbExperimentsByRouteKey(
      abTests,
      featureFlags,
    );
    context.locals.abExperimentsByRouteKey = abExperimentsByRouteKey;

    const rewriteDecision = decideAbRewrite({
      pathname: context.url.pathname,
      abTests,
      featureFlags,
      abExperimentsByRouteKey,
    });
    if (!rewriteDecision.rewrittenPath) {
      return next();
    }

    context.locals.rewrittenDocumentSlug = rewriteDecision.canonicalDocumentSlug;
    context.locals.rewrittenDocumentType = rewriteDecision.documentType;

    const rewrittenUrl = new URL(context.url);
    rewrittenUrl.pathname = rewriteDecision.rewrittenPath;

    console.info("[middleware][posthog] rewriting route", {
      from: context.url.pathname,
      to: rewriteDecision.rewrittenPath,
      documentType: rewriteDecision.documentType,
      distinctId,
      experiments: rewriteDecision.experiments ?? [],
    });

    return context.rewrite(rewrittenUrl);
  } catch {
    context.locals.abExperimentsByRouteKey = {};
  }

  return next();
});

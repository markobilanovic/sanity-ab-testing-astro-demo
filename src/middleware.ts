import { defineMiddleware } from "astro:middleware";
import { PostHog } from "posthog-node";
import {
  AB_TEST_VARIANT_ROUTES_QUERY,
  type AbTestRouteSource,
} from "./sanity/lib/ab-routing";
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

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNonEmptyStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeNonEmptyString(value))
    .filter((value): value is string => Boolean(value));
}

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

function extractFeatureFlags(
  value: unknown,
): Record<string, string | boolean | undefined> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const maybeFlags = (value as { featureFlags?: unknown }).featureFlags;
  if (!maybeFlags || typeof maybeFlags !== "object") {
    return {};
  }

  const flags: Record<string, string | boolean | undefined> = {};
  for (const [key, flagValue] of Object.entries(
    maybeFlags as Record<string, unknown>,
  )) {
    if (
      typeof flagValue === "string" ||
      typeof flagValue === "boolean" ||
      typeof flagValue === "undefined"
    ) {
      flags[key] = flagValue;
    }
  }

  return flags;
}

function buildAbExperimentsByPostSlug(
  abTests: AbTestRouteSource[],
  featureFlags: Record<string, string | boolean | undefined>,
): Record<string, AbMiddlewareExperiment[]> {
  const byPostSlug: Record<string, AbMiddlewareExperiment[]> = {};

  for (const abTest of abTests) {
    const abTestDocId = normalizeNonEmptyString(abTest._id);
    const abId = normalizeNonEmptyString(abTest.id);
    if (!abTestDocId || !abId) {
      continue;
    }

    const assignedVariant = featureFlags[abId];
    if (typeof assignedVariant !== "string") {
      continue;
    }

    const variantCodes = new Set(normalizeNonEmptyStrings(abTest.variantCodes));
    if (!variantCodes.has(assignedVariant)) {
      continue;
    }

    const referencedPostSlugs = normalizeNonEmptyStrings(
      (abTest.referencedPosts ?? []).map((post) => post.slug?.current),
    );
    if (referencedPostSlugs.length === 0) {
      continue;
    }

    for (const postSlug of referencedPostSlugs) {
      byPostSlug[postSlug] ??= [];
      byPostSlug[postSlug].push({
        abId,
        abTestDocId,
        variantCode: assignedVariant,
      });
    }
  }

  return byPostSlug;
}

function getActiveFeatureFlags(
  featureFlags: Record<string, string | boolean | undefined>,
): Record<string, true | string> {
  const activeFlags: Record<string, true | string> = {};

  for (const [flagKey, flagValue] of Object.entries(featureFlags)) {
    if (flagValue === true) {
      activeFlags[flagKey] = true;
      continue;
    }

    if (typeof flagValue === "string" && flagValue.length > 0) {
      activeFlags[flagKey] = flagValue;
    }
  }

  return activeFlags;
}

function getCanonicalPostSlug(pathname: string): string | null {
  const match = /^\/post\/([^/]+)\/?$/.exec(pathname);
  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const client = getPosthogClient();
  if (!client) {
    context.locals.abExperimentsByPostSlug = {};
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
    context.locals.abExperimentsByPostSlug = buildAbExperimentsByPostSlug(
      abTests,
      featureFlags,
    );

    const canonicalPostSlug = getCanonicalPostSlug(context.url.pathname);
    if (!canonicalPostSlug) {
      return next();
    }

    const assignedExperiments =
      context.locals.abExperimentsByPostSlug[canonicalPostSlug] ?? [];
    const selectedExperiment = assignedExperiments[0];
    if (!selectedExperiment) {
      return next();
    }

    const rewrittenSlug = `${canonicalPostSlug}-${selectedExperiment.abId}-${selectedExperiment.variantCode}`;
    const rewrittenPath = `/post/${encodeURIComponent(rewrittenSlug)}`;
    if (rewrittenPath === context.url.pathname) {
      return next();
    }

    context.locals.rewrittenPostSlug = canonicalPostSlug;
    context.locals.rewrittenExperiment = selectedExperiment;

    const rewrittenUrl = new URL(context.url);
    rewrittenUrl.pathname = rewrittenPath;

    console.info("[middleware][posthog] rewriting post url", {
      from: context.url.pathname,
      to: rewrittenPath,
      distinctId,
      experiment: selectedExperiment,
    });

    return context.rewrite(rewrittenUrl);
  } catch {
    context.locals.abExperimentsByPostSlug = {};
  }

  return next();
});

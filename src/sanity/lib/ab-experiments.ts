import type {
  AbRouteContext,
  AbRouteProps,
  AbTestRouteSource,
} from "./ab-routing";
import { orderAndDedupeAbRouteContexts, resolveAbRouteContexts } from "./ab-routing";

export type AbFeatureFlags = Record<string, string | boolean | undefined>;

export type AbMiddlewareExperiment = {
  abId: string;
  abTestDocId: string;
  variantCode: string;
};

type AbRouteStateInput = {
  routeSlug?: string;
  routeProps?: Partial<AbRouteProps>;
  rewrittenPostSlug?: string;
  abExperimentsByPostSlug?: Record<string, AbMiddlewareExperiment[]>;
};

type AbRouteState = {
  postSlug?: string;
  contexts: AbRouteContext[];
  shouldResolveFromRouteSlug: boolean;
};

export function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeNonEmptyStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeNonEmptyString(value))
    .filter((value): value is string => Boolean(value));
}

export function extractFeatureFlags(value: unknown): AbFeatureFlags {
  if (!value || typeof value !== "object") {
    return {};
  }

  const maybeFlags = (value as { featureFlags?: unknown }).featureFlags;
  if (!maybeFlags || typeof maybeFlags !== "object") {
    return {};
  }

  const flags: AbFeatureFlags = {};
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

export function getActiveFeatureFlags(
  featureFlags: AbFeatureFlags,
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

export function buildAbExperimentsByPostSlug(
  abTests: AbTestRouteSource[],
  featureFlags: AbFeatureFlags,
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

export function getRequestedPostSlug(pathname: string): string | null {
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

export function getCanonicalPostSlug(routeSlug: string): string | null {
  const normalizedRouteSlug = normalizeNonEmptyString(routeSlug);
  if (!normalizedRouteSlug) {
    return null;
  }

  const canonicalPostSlug = normalizedRouteSlug.split("--")[0];
  return normalizeNonEmptyString(canonicalPostSlug);
}

export function toAbRouteContexts(
  experiments: AbMiddlewareExperiment[],
): AbRouteContext[] {
  return experiments
    .filter((experiment) => Boolean(experiment))
    .map((experiment) => ({
      abTestDocId: experiment.abTestDocId,
      variantCode: experiment.variantCode,
    }));
}

export function resolveAbRouteStateForRequest({
  routeSlug,
  routeProps,
  rewrittenPostSlug,
  abExperimentsByPostSlug,
}: AbRouteStateInput): AbRouteState {
  const canonicalRouteSlug = normalizeNonEmptyString(routeSlug) ?? undefined;
  const canonicalPropPostSlug =
    normalizeNonEmptyString(routeProps?.postSlug) ?? undefined;
  const canonicalRewrittenPostSlug =
    normalizeNonEmptyString(rewrittenPostSlug) ?? undefined;

  const postSlug =
    canonicalPropPostSlug ?? canonicalRewrittenPostSlug ?? canonicalRouteSlug;
  const routeContexts = resolveAbRouteContexts(routeProps ?? {});
  const middlewareContexts = postSlug
    ? toAbRouteContexts(abExperimentsByPostSlug?.[postSlug] ?? [])
    : [];

  return {
    postSlug,
    contexts: orderAndDedupeAbRouteContexts([
      ...routeContexts,
      ...middlewareContexts,
    ]),
    shouldResolveFromRouteSlug: Boolean(
      canonicalRouteSlug &&
        routeContexts.length === 0 &&
        !canonicalRewrittenPostSlug &&
        !canonicalPropPostSlug,
    ),
  };
}

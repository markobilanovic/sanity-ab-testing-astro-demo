import type {
  AbDocumentType,
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
  rewrittenDocumentSlug?: string;
  rewrittenDocumentType?: AbDocumentType;
  defaultDocumentType: AbDocumentType;
  abExperimentsByRouteKey?: Record<string, AbMiddlewareExperiment[]>;
};

type AbRouteState = {
  documentSlug?: string;
  documentType: AbDocumentType;
  contexts: AbRouteContext[];
  shouldResolveFromRouteSlug: boolean;
};

type AbRouteRequestTarget = {
  documentType: AbDocumentType;
  requestedSlug: string;
};

const AB_DOCUMENT_TYPES: AbDocumentType[] = ["post", "page"];
const AB_TEST_REFERENCE_FIELD_BY_TYPE: Record<AbDocumentType, keyof AbTestRouteSource> = {
  post: "referencedPosts",
  page: "referencedPages",
};
const RESERVED_ROOT_SEGMENTS = new Set([
  "post",
  "studio",
  "api",
  "_astro",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "sitemap-index.xml",
]);

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

export function buildRouteKey(documentType: AbDocumentType, slug: string): string {
  return `${documentType}:${slug}`;
}

export function buildAbExperimentsByRouteKey(
  abTests: AbTestRouteSource[],
  featureFlags: AbFeatureFlags,
): Record<string, AbMiddlewareExperiment[]> {
  const byRouteKey: Record<string, AbMiddlewareExperiment[]> = {};

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

    for (const documentType of AB_DOCUMENT_TYPES) {
      const referenceField = AB_TEST_REFERENCE_FIELD_BY_TYPE[documentType];
      const referencedDocumentSlugs = normalizeNonEmptyStrings(
        ((abTest[referenceField] as Array<{ slug?: { current?: string } }> | undefined) ?? [])
          .map((document) => document.slug?.current),
      );
      if (referencedDocumentSlugs.length === 0) {
        continue;
      }

      for (const documentSlug of referencedDocumentSlugs) {
        const routeKey = buildRouteKey(documentType, documentSlug);
        byRouteKey[routeKey] ??= [];
        byRouteKey[routeKey].push({
          abId,
          abTestDocId,
          variantCode: assignedVariant,
        });
      }
    }
  }

  return byRouteKey;
}

export function getRequestedAbRoute(pathname: string): AbRouteRequestTarget | null {
  const postMatch = /^\/post\/([^/]+)\/?$/.exec(pathname);
  if (postMatch) {
    try {
      return {
        documentType: "post",
        requestedSlug: decodeURIComponent(postMatch[1]),
      };
    } catch {
      return { documentType: "post", requestedSlug: postMatch[1] };
    }
  }

  const pageMatch = /^\/([^/]+)\/?$/.exec(pathname);
  if (!pageMatch) {
    return null;
  }

  const pageSegment = pageMatch[1];
  if (!pageSegment || RESERVED_ROOT_SEGMENTS.has(pageSegment) || pageSegment.includes(".")) {
    return null;
  }

  try {
    return {
      documentType: "page",
      requestedSlug: decodeURIComponent(pageSegment),
    };
  } catch {
    return { documentType: "page", requestedSlug: pageSegment };
  }
}

export function getCanonicalDocumentSlug(routeSlug: string): string | null {
  const normalizedRouteSlug = normalizeNonEmptyString(routeSlug);
  if (!normalizedRouteSlug) {
    return null;
  }

  const canonicalDocumentSlug = normalizedRouteSlug.split("--")[0];
  return normalizeNonEmptyString(canonicalDocumentSlug);
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
  rewrittenDocumentSlug,
  rewrittenDocumentType,
  defaultDocumentType,
  abExperimentsByRouteKey,
}: AbRouteStateInput): AbRouteState {
  const canonicalRouteSlug = normalizeNonEmptyString(routeSlug) ?? undefined;
  const canonicalPropDocumentSlug = normalizeNonEmptyString(routeProps?.documentSlug) ?? undefined;
  const canonicalRewrittenDocumentSlug =
    normalizeNonEmptyString(rewrittenDocumentSlug) ?? undefined;
  const documentType =
    routeProps?.documentType ?? rewrittenDocumentType ?? defaultDocumentType;

  const documentSlug =
    canonicalPropDocumentSlug ?? canonicalRewrittenDocumentSlug ?? canonicalRouteSlug;
  const routeContexts = resolveAbRouteContexts(routeProps ?? {});
  const middlewareContexts = documentSlug
    ? toAbRouteContexts(
        abExperimentsByRouteKey?.[buildRouteKey(documentType, documentSlug)] ?? [],
      )
    : [];

  return {
    documentSlug,
    documentType,
    contexts: orderAndDedupeAbRouteContexts([
      ...routeContexts,
      ...middlewareContexts,
    ]),
    shouldResolveFromRouteSlug: Boolean(
      canonicalRouteSlug &&
        routeContexts.length === 0 &&
        !canonicalRewrittenDocumentSlug &&
        !canonicalPropDocumentSlug,
    ),
  };
}

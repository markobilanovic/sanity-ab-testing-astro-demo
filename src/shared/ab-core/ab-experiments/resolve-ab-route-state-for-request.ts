import type { AbDocumentType, AbRouteContext, AbRouteProps } from "../ab-routing";
import {
  normalizeNonEmptyString,
  orderAndDedupeAbRouteContexts,
  resolveAbRouteContexts,
} from "../ab-routing";
import { buildRouteKey } from "./build-route-key";
import { toAbRouteContexts } from "./to-ab-route-contexts";
import type { AbMiddlewareExperiment } from "./types";

export type AbRouteStateInput = {
  routeSlug?: string;
  routeProps?: Partial<AbRouteProps>;
  rewrittenDocumentSlug?: string;
  rewrittenDocumentType?: AbDocumentType;
  defaultDocumentType: AbDocumentType;
  abExperimentsByRouteKey?: Record<string, AbMiddlewareExperiment[]>;
};

export type AbRouteState = {
  documentSlug?: string;
  documentType: AbDocumentType;
  contexts: AbRouteContext[];
  shouldResolveFromRouteSlug: boolean;
};

export function resolveAbRouteStateForRequest({
  routeSlug,
  routeProps,
  rewrittenDocumentSlug,
  rewrittenDocumentType,
  defaultDocumentType,
  abExperimentsByRouteKey,
}: AbRouteStateInput): AbRouteState {
  const canonicalRouteSlug = normalizeNonEmptyString(routeSlug) ?? undefined;
  const canonicalPropDocumentSlug =
    normalizeNonEmptyString(routeProps?.documentSlug) ?? undefined;
  const canonicalRewrittenDocumentSlug =
    normalizeNonEmptyString(rewrittenDocumentSlug) ?? undefined;
  const documentType =
    routeProps?.documentType ?? rewrittenDocumentType ?? defaultDocumentType;

  const documentSlug =
    canonicalPropDocumentSlug ??
    canonicalRewrittenDocumentSlug ??
    canonicalRouteSlug;
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

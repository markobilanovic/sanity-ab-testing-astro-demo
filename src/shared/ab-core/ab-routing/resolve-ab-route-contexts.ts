import { normalizeNonEmptyString } from "./normalize-non-empty-string.js";
import { orderAndDedupeAbRouteContexts } from "./order-and-dedupe-ab-route-contexts.js";
import type { AbRouteContext, AbRouteProps } from "./types.js";

export function resolveAbRouteContexts(props: Partial<AbRouteProps>): AbRouteContext[] {
  if (!Array.isArray(props.contexts)) {
    return [];
  }

  const contexts: AbRouteContext[] = [];
  for (const context of props.contexts) {
    if (!context || typeof context !== "object") {
      continue;
    }

    const abTestDocId = normalizeNonEmptyString(
      (context as { abTestDocId?: unknown }).abTestDocId,
    );
    const variantCode = normalizeNonEmptyString(
      (context as { variantCode?: unknown }).variantCode,
    );
    if (!abTestDocId || !variantCode) {
      continue;
    }

    contexts.push({ abTestDocId, variantCode });
  }

  return orderAndDedupeAbRouteContexts(contexts);
}

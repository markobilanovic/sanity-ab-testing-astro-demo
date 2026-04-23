import { applyAbVariantsForContext } from "./apply-ab-variants-for-context.js";
import type { AbRouteContext } from "./types.js";

export function applyAbVariants<T>(
  value: T,
  context: AbRouteContext | AbRouteContext[] | null,
): T {
  if (!context) {
    return value;
  }

  const contexts = Array.isArray(context) ? context : [context];
  if (contexts.length === 0) {
    return value;
  }

  return contexts.reduce<unknown>(
    (currentValue, currentContext) =>
      applyAbVariantsForContext(currentValue, currentContext),
    value as unknown,
  ) as T;
}

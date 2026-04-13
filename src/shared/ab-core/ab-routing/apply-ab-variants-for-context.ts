import {
  AB_TEST_REF_FIELD_NAME,
  AB_TOGGLE_FIELD_NAME,
  AB_VARIANTS_FIELD_NAME,
} from "./constants";
import type { AbRouteContext } from "./types";

export function applyAbVariantsForContext(
  value: unknown,
  context: AbRouteContext,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => applyAbVariantsForContext(item, context));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  let nextRecord = record;

  const isAbEnabled = record[AB_TOGGLE_FIELD_NAME] === true;
  const abTestRef = record[AB_TEST_REF_FIELD_NAME] as { _ref?: string } | undefined;
  const variants = record[AB_VARIANTS_FIELD_NAME];

  if (
    isAbEnabled &&
    abTestRef?._ref === context.abTestDocId &&
    Array.isArray(variants)
  ) {
    const matchedVariant = variants.find((variant) => {
      if (!variant || typeof variant !== "object") {
        return false;
      }

      return (
        (variant as Record<string, unknown>).variantCode === context.variantCode
      );
    }) as Record<string, unknown> | undefined;

    const variantContent =
      matchedVariant && typeof matchedVariant.variant === "object"
        ? (matchedVariant.variant as Record<string, unknown>)
        : null;

    if (variantContent) {
      nextRecord = {
        ...record,
        ...variantContent,
      };
    }
  }

  const transformedRecord: Record<string, unknown> = {};
  for (const [key, itemValue] of Object.entries(nextRecord)) {
    transformedRecord[key] = applyAbVariantsForContext(itemValue, context);
  }

  return transformedRecord;
}

import type { AbFeatureFlags } from "./types";

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

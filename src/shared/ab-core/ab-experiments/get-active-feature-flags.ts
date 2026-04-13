import type { AbFeatureFlags } from "./types";

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

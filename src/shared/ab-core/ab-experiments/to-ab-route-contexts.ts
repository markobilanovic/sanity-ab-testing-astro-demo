import type { AbRouteContext } from "../ab-routing/index.js";
import type { AbMiddlewareExperiment } from "./types.js";

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

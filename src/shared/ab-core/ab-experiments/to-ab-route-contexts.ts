import type { AbRouteContext } from "../ab-routing";
import type { AbMiddlewareExperiment } from "./types";

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

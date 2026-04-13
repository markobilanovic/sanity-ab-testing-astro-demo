import type { AbRouteContext, AbRouteTest } from "./types";

export function buildCartesianCombinations(
  tests: AbRouteTest[],
): Array<{
  segments: Array<{ abId: string; variantCode: string }>;
  contexts: AbRouteContext[];
}> {
  if (tests.length === 0) {
    return [];
  }

  const combinations: Array<{
    segments: Array<{ abId: string; variantCode: string }>;
    contexts: AbRouteContext[];
  }> = [];

  const currentSegments: Array<{ abId: string; variantCode: string }> = [];
  const currentContexts: AbRouteContext[] = [];

  const buildAtDepth = (depth: number): void => {
    if (depth >= tests.length) {
      combinations.push({
        segments: [...currentSegments],
        contexts: [...currentContexts],
      });
      return;
    }

    const test = tests[depth];
    for (const variantCode of test.variantCodes) {
      currentSegments.push({ abId: test.abId, variantCode });
      currentContexts.push({ abTestDocId: test.abTestDocId, variantCode });

      buildAtDepth(depth + 1);

      currentSegments.pop();
      currentContexts.pop();
    }
  };

  buildAtDepth(0);
  return combinations;
}

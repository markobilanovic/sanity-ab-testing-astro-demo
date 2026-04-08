export const POST_SLUGS_QUERY = `*[_type == "post" && defined(slug.current)].slug.current`;
export const PAGE_SLUGS_QUERY = `*[_type == "page" && defined(slug.current)].slug.current`;

export const AB_TEST_VARIANT_ROUTES_QUERY = `*[_type == "abTest" && defined(id)]{
  _id,
  id,
  variantCodes,
  "referencedPosts": *[
    _type == "post" &&
    defined(slug.current) &&
    references(^._id)
  ]{
    slug
  },
  "referencedPages": *[
    _type == "page" &&
    defined(slug.current) &&
    references(^._id)
  ]{
    slug
  }
}`;

export const POST_BY_SLUG_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  _id,
  title,
  body,
  slug,
  relatedPostsSection{
    ...,
    title,
    "relatedPosts": relatedPosts[]->{
      _id,
      title,
      "slug": slug.current
    }
  },
  showAbVariant,
  abTestRef,
  abVariants
}`;

export const PAGE_BY_SLUG_QUERY = `*[_type == "page" && slug.current == $slug][0]{
  _id,
  title,
  body,
  slug,
  showAbVariant,
  abTestRef,
  abVariants
}`;

export type AbTestRouteSource = {
  _id?: string;
  id?: string;
  variantCodes?: string[];
  referencedPosts?: Array<{ slug?: { current?: string } }>;
  referencedPages?: Array<{ slug?: { current?: string } }>;
};

export type AbRouteProps = {
  documentSlug: string;
  documentType?: AbDocumentType;
  contexts: AbRouteContext[];
};

export type AbRouteContext = {
  abTestDocId: string;
  variantCode: string;
};

const AB_TOGGLE_FIELD_NAME = "showAbVariant";
const AB_VARIANTS_FIELD_NAME = "abVariants";
const AB_TEST_REF_FIELD_NAME = "abTestRef";
const COMPOSITE_SEGMENT_SEPARATOR = "--";
const COMPOSITE_PAIR_SEPARATOR = "-";

export type AbDocumentType = "post" | "page";

const AB_TEST_REFERENCES_BY_DOCUMENT_TYPE: Record<AbDocumentType, keyof AbTestRouteSource> = {
  post: "referencedPosts",
  page: "referencedPages",
};

type AbRouteTest = {
  abId: string;
  abTestDocId: string;
  variantCodes: string[];
};

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNonEmptyStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeNonEmptyString(value))
    .filter((value): value is string => Boolean(value));
}

export function buildAbStaticPaths(
  documentSlugs: string[],
  abTests: AbTestRouteSource[],
  documentType: AbDocumentType = "post",
): Array<{ params: { slug: string }; props: AbRouteProps }> {
  const staticPaths: Array<{ params: { slug: string }; props: AbRouteProps }> = [];
  const seenRouteSlugs = new Set<string>();

  for (const documentSlug of documentSlugs) {
    const normalizedDocumentSlug = normalizeNonEmptyString(documentSlug);
    if (!normalizedDocumentSlug || seenRouteSlugs.has(normalizedDocumentSlug)) {
      continue;
    }

    seenRouteSlugs.add(normalizedDocumentSlug);
    staticPaths.push({
      params: { slug: normalizedDocumentSlug },
      props: {
        documentSlug: normalizedDocumentSlug,
        documentType,
        contexts: [],
      },
    });

    const routeTests = getTestsForDocumentSlug(
      normalizedDocumentSlug,
      abTests,
      documentType,
    );
    const routeCombinations = buildCartesianCombinations(routeTests);

    for (const routeCombination of routeCombinations) {
      const routeSlug = serializeCompositeSlug(
        normalizedDocumentSlug,
        routeCombination.segments,
      );
      if (seenRouteSlugs.has(routeSlug)) {
        continue;
      }

      seenRouteSlugs.add(routeSlug);
      staticPaths.push({
        params: { slug: routeSlug },
        props: {
          documentSlug: normalizedDocumentSlug,
          documentType,
          contexts: routeCombination.contexts,
        },
      });
    }
  }

  return staticPaths;
}

export function resolveAbRouteFromSlug(
  routeSlug: string,
  abTests: AbTestRouteSource[],
  documentType: AbDocumentType = "post",
): AbRouteProps | null {
  const normalizedRouteSlug = normalizeNonEmptyString(routeSlug);
  if (!normalizedRouteSlug) {
    return null;
  }

  const routeParts = normalizedRouteSlug.split(COMPOSITE_SEGMENT_SEPARATOR);
  const normalizedDocumentSlug = normalizeNonEmptyString(routeParts[0]);
  if (!normalizedDocumentSlug) {
    return null;
  }

  const routeTests = getTestsForDocumentSlug(
    normalizedDocumentSlug,
    abTests,
    documentType,
  );
  if (routeParts.length === 1) {
    return {
      documentSlug: normalizedDocumentSlug,
      documentType,
      contexts: [],
    };
  }

  const remainingParts = routeParts.slice(1);
  const seenAbIds = new Set<string>();
  const contexts: AbRouteContext[] = [];

  for (const routePart of remainingParts) {
    const normalizedPart = normalizeNonEmptyString(routePart);
    if (!normalizedPart) {
      return null;
    }

    const matchingTest = routeTests.find((test) =>
      normalizedPart.startsWith(`${test.abId}${COMPOSITE_PAIR_SEPARATOR}`),
    );
    if (!matchingTest) {
      return null;
    }

    if (seenAbIds.has(matchingTest.abId)) {
      return null;
    }

    const variantCode = normalizeNonEmptyString(
      normalizedPart.slice(
        matchingTest.abId.length + COMPOSITE_PAIR_SEPARATOR.length,
      ),
    );
    if (!variantCode || !matchingTest.variantCodes.includes(variantCode)) {
      return null;
    }

    seenAbIds.add(matchingTest.abId);
    contexts.push({
      abTestDocId: matchingTest.abTestDocId,
      variantCode,
    });
  }

  const orderedContexts = orderAndDedupeAbRouteContexts(contexts, routeTests);
  if (orderedContexts.length !== contexts.length) {
    return null;
  }

  return {
    documentSlug: normalizedDocumentSlug,
    documentType,
    contexts: orderedContexts,
  };
}

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

export function serializeCompositeSlug(
  documentSlug: string,
  assignments: Array<{ abId: string; variantCode: string }>,
): string {
  const normalizedDocumentSlug = normalizeNonEmptyString(documentSlug);
  if (!normalizedDocumentSlug) {
    return "";
  }

  const canonicalAssignments = assignments
    .map((assignment) => ({
      abId: normalizeNonEmptyString(assignment.abId),
      variantCode: normalizeNonEmptyString(assignment.variantCode),
    }))
    .filter(
      (
        assignment,
      ): assignment is {
        abId: string;
        variantCode: string;
      } => Boolean(assignment.abId && assignment.variantCode),
    )
    .sort((left, right) => left.abId.localeCompare(right.abId));

  if (canonicalAssignments.length === 0) {
    return normalizedDocumentSlug;
  }

  const seenAbIds = new Set<string>();
  const uniqueAssignments: Array<{ abId: string; variantCode: string }> = [];
  for (const assignment of canonicalAssignments) {
    if (seenAbIds.has(assignment.abId)) {
      continue;
    }
    seenAbIds.add(assignment.abId);
    uniqueAssignments.push(assignment);
  }

  const routeSegments = uniqueAssignments.map(
    ({ abId, variantCode }) => `${abId}${COMPOSITE_PAIR_SEPARATOR}${variantCode}`,
  );
  return `${normalizedDocumentSlug}${COMPOSITE_SEGMENT_SEPARATOR}${routeSegments.join(COMPOSITE_SEGMENT_SEPARATOR)}`;
}

export function orderAndDedupeAbRouteContexts(
  contexts: AbRouteContext[],
  knownTests: AbRouteTest[] = [],
): AbRouteContext[] {
  const knownAbTestDocIds = new Set(knownTests.map((test) => test.abTestDocId));
  const abTestDocIdOrder = new Map(
    knownTests.map((test, index) => [test.abTestDocId, index] as const),
  );

  const dedupedContextsByTest = new Map<string, AbRouteContext>();
  for (const context of contexts) {
    if (!context || typeof context !== "object") {
      continue;
    }

    const abTestDocId = normalizeNonEmptyString(context.abTestDocId);
    const variantCode = normalizeNonEmptyString(context.variantCode);
    if (!abTestDocId || !variantCode) {
      continue;
    }

    if (knownAbTestDocIds.size > 0 && !knownAbTestDocIds.has(abTestDocId)) {
      continue;
    }

    if (!dedupedContextsByTest.has(abTestDocId)) {
      dedupedContextsByTest.set(abTestDocId, { abTestDocId, variantCode });
    }
  }

  return [...dedupedContextsByTest.values()].sort((left, right) => {
    const leftOrder = abTestDocIdOrder.get(left.abTestDocId);
    const rightOrder = abTestDocIdOrder.get(right.abTestDocId);

    if (typeof leftOrder === "number" && typeof rightOrder === "number") {
      return leftOrder - rightOrder;
    }
    if (typeof leftOrder === "number") {
      return -1;
    }
    if (typeof rightOrder === "number") {
      return 1;
    }

    return left.abTestDocId.localeCompare(right.abTestDocId);
  });
}

export function getTestsForDocumentSlug(
  documentSlug: string,
  abTests: AbTestRouteSource[],
  documentType: AbDocumentType = "post",
): AbRouteTest[] {
  const normalizedDocumentSlug = normalizeNonEmptyString(documentSlug);
  if (!normalizedDocumentSlug) {
    return [];
  }

  const testsForPost: AbRouteTest[] = [];
  for (const abTest of abTests) {
    const abTestDocId = normalizeNonEmptyString(abTest._id);
    const abId = normalizeNonEmptyString(abTest.id);
    if (!abTestDocId || !abId) {
      continue;
    }

    const variantCodes = normalizeNonEmptyStrings(abTest.variantCodes);
    if (variantCodes.length === 0) {
      continue;
    }

    const referenceField = AB_TEST_REFERENCES_BY_DOCUMENT_TYPE[documentType];
    const referencedDocumentSlugs = new Set(
      normalizeNonEmptyStrings(
        ((abTest[referenceField] as Array<{ slug?: { current?: string } }> | undefined) ?? [])
          .map((document) => document.slug?.current),
      ),
    );
    if (!referencedDocumentSlugs.has(normalizedDocumentSlug)) {
      continue;
    }

    testsForPost.push({
      abId,
      abTestDocId,
      variantCodes,
    });
  }

  return testsForPost.sort((left, right) => left.abId.localeCompare(right.abId));
}

function buildCartesianCombinations(
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

function applyAbVariantsForContext(
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

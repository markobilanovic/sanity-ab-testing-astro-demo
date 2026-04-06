export const POST_SLUGS_QUERY = `*[_type == "post" && defined(slug.current)].slug.current`;

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
  }
}`;

export const POST_BY_SLUG_QUERY = `*[_type == "post" && slug.current == $slug][0]{
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
};

export type AbRouteProps = {
  postSlug: string;
  abId: string | null;
  abTestDocId: string | null;
  variantCode: string | null;
};

export type AbRouteContext = {
  abTestDocId: string;
  variantCode: string;
};

const AB_TOGGLE_FIELD_NAME = "showAbVariant";
const AB_VARIANTS_FIELD_NAME = "abVariants";
const AB_TEST_REF_FIELD_NAME = "abTestRef";

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

export function buildAbPostStaticPaths(
  postSlugs: string[],
  abTests: AbTestRouteSource[],
): Array<{ params: { slug: string }; props: AbRouteProps }> {
  const staticPaths: Array<{ params: { slug: string }; props: AbRouteProps }> = [];
  const seenRouteSlugs = new Set<string>();

  for (const postSlug of postSlugs) {
    const normalizedPostSlug = normalizeNonEmptyString(postSlug);
    if (!normalizedPostSlug || seenRouteSlugs.has(normalizedPostSlug)) {
      continue;
    }

    seenRouteSlugs.add(normalizedPostSlug);
    staticPaths.push({
      params: { slug: normalizedPostSlug },
      props: {
        postSlug: normalizedPostSlug,
        abId: null,
        abTestDocId: null,
        variantCode: null,
      },
    });
  }

  for (const abTest of abTests) {
    const abTestDocId = normalizeNonEmptyString(abTest._id);
    const abId = normalizeNonEmptyString(abTest.id);
    if (!abTestDocId || !abId) {
      continue;
    }

    const referencedPostSlugs = normalizeNonEmptyStrings(
      (abTest.referencedPosts ?? []).map((post) => post.slug?.current),
    );
    const variantCodes = normalizeNonEmptyStrings(abTest.variantCodes);

    for (const postSlug of referencedPostSlugs) {
      for (const variantCode of variantCodes) {
        const routeSlug = `${postSlug}-${abId}-${variantCode}`;
        if (seenRouteSlugs.has(routeSlug)) {
          continue;
        }

        seenRouteSlugs.add(routeSlug);
        staticPaths.push({
          params: { slug: routeSlug },
          props: {
            postSlug,
            abId,
            abTestDocId,
            variantCode,
          },
        });
      }
    }
  }

  return staticPaths;
}

export function resolveAbRouteFromSlug(
  routeSlug: string,
  abTests: AbTestRouteSource[],
): AbRouteProps | null {
  const normalizedRouteSlug = normalizeNonEmptyString(routeSlug);
  if (!normalizedRouteSlug) {
    return null;
  }

  for (const abTest of abTests) {
    const abTestDocId = normalizeNonEmptyString(abTest._id);
    const abId = normalizeNonEmptyString(abTest.id);
    if (!abTestDocId || !abId) {
      continue;
    }

    const referencedPostSlugs = normalizeNonEmptyStrings(
      (abTest.referencedPosts ?? []).map((post) => post.slug?.current),
    );
    const variantCodes = normalizeNonEmptyStrings(abTest.variantCodes);

    for (const postSlug of referencedPostSlugs) {
      for (const variantCode of variantCodes) {
        const candidateRouteSlug = `${postSlug}-${abId}-${variantCode}`;
        if (candidateRouteSlug !== normalizedRouteSlug) {
          continue;
        }

        return {
          postSlug,
          abId,
          abTestDocId,
          variantCode,
        };
      }
    }
  }

  return null;
}

export function resolveAbRouteContext(
  props: Partial<AbRouteProps>,
): AbRouteContext | null {
  const abTestDocId = normalizeNonEmptyString(props.abTestDocId);
  const variantCode = normalizeNonEmptyString(props.variantCode);
  if (!abTestDocId || !variantCode) {
    return null;
  }

  return { abTestDocId, variantCode };
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

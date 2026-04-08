import React, { useEffect, useMemo, useState } from "react";
import { Card, Select, Stack, Text } from "@sanity/ui";
import {
  defineField,
  defineType,
  defineDocumentFieldAction,
  definePlugin,
  isObjectInputProps,
  set,
  useClient,
  useFormValue,
  type Path,
  type DocumentActionComponent,
  type DocumentActionProps,
  type StringInputProps,
  type ObjectInputProps,
} from "sanity";
import { createAbObjectCustomizer } from "./abObjectCustomizer";
import { createComposedObjectInput } from "./ComposedObjectInput.tsx";
import { withAbObject } from "./withAbObject";
import {
  AB_CONFIG_ACTION_EVENT_NAME,
  DEFAULT_AB_TEST_TYPE_NAME,
  DEFAULT_STUDIO_API_VERSION,
  resolveAbFieldNames,
  type AbFieldNameOverrides,
} from "./abConfig";

const AB_TEST_ID_FIELD_NAME = "id";
const AB_TEST_VARIANT_CODES_FIELD_NAME = "variantCodes";
const DEFAULT_REVALIDATE_ENDPOINT_PATH = "/api/revalidate";
const DEFAULT_REVALIDATE_DOCUMENT_TYPE = "post";
const DEFAULT_REVALIDATE_DELAY_MS = 1500;

type AbFeatureFlag = {
  id: string;
  name?: string;
  variantCodes: string[];
};

type AbTestAdapter = {
  sourceName: string;
  loadFeatureFlags: () => Promise<AbFeatureFlag[]>;
};

type PostHogAdapterOptions = {
  host?: string;
  projectId?: string;
  personalApiKey?: string;
};

type RevalidationDocumentConfig = {
  type?: string;
  pathPrefix?: string;
  tagPrefix?: string;
};

type RevalidationConfig = {
  documents?: RevalidationDocumentConfig[];
  endpointPath?: string;
  secretEnvVar?: string;
  delayMs?: number;
};

type ResolvedRevalidationDocumentConfig = {
  type: string;
  pathPrefix: string;
  tagPrefix: string;
};

type ResolvedRevalidationConfig = {
  documentsByType: Map<string, ResolvedRevalidationDocumentConfig>;
  endpointPath: string;
  secretEnvVar: string;
  delayMs: number;
  getDocument: (documentType: string) => ResolvedRevalidationDocumentConfig | null;
};

export type AbObjectCloningOptions = {
  adapter?: AbTestAdapter;
  posthog?: PostHogAdapterOptions;
  abTestTypeName?: string;
  fieldNames?: AbFieldNameOverrides;
  revalidation?: RevalidationConfig | false;
};

type PostDocumentLike = {
  _id?: string;
  slug?: { current?: string };
};

function normalizeNonEmptyStrings(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(
    new Set(
      input
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeNonEmptyString(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getCanonicalDocumentId(value: unknown): string | null {
  const id = normalizeNonEmptyString(value);
  if (!id) {
    return null;
  }

  return id.startsWith("drafts.") ? id.slice("drafts.".length) : id;
}

function getPostSlug(document: unknown): string | null {
  const slugValue = (document as PostDocumentLike | undefined)?.slug?.current;
  return normalizeNonEmptyString(slugValue);
}

function getSchemaTypeName(schemaType: unknown): string | null {
  if (typeof schemaType === "string") {
    return normalizeNonEmptyString(schemaType);
  }

  return normalizeNonEmptyString((schemaType as { name?: unknown })?.name);
}

function resolveRevalidationConfig(
  config: RevalidationConfig | false | undefined,
): ResolvedRevalidationConfig | null {
  if (config === false || config === undefined) {
    return null;
  }

  const endpointPath =
    normalizeNonEmptyString(config?.endpointPath) ?? DEFAULT_REVALIDATE_ENDPOINT_PATH;
  const delayMs =
    typeof config?.delayMs === "number" && Number.isFinite(config.delayMs)
      ? Math.max(0, config.delayMs)
      : DEFAULT_REVALIDATE_DELAY_MS;
  const secretEnvVar =
    normalizeNonEmptyString(config?.secretEnvVar) ??
    "SANITY_STUDIO_ASTRO_REVALIDATE_SECRET";
  const configuredDocuments = Array.isArray(config?.documents)
    ? config.documents
    : [];

  const documentsByType = new Map<string, ResolvedRevalidationDocumentConfig>();
  for (const documentConfig of configuredDocuments) {
    const type = normalizeNonEmptyString(documentConfig?.type);
    if (!type || documentsByType.has(type)) {
      continue;
    }

    const pathPrefix = normalizeNonEmptyString(documentConfig.pathPrefix) ?? type;
    const tagPrefix = normalizeNonEmptyString(documentConfig.tagPrefix) ?? type;
    documentsByType.set(type, {
      type,
      pathPrefix,
      tagPrefix,
    });
  }

  if (documentsByType.size === 0) {
    documentsByType.set(DEFAULT_REVALIDATE_DOCUMENT_TYPE, {
      type: DEFAULT_REVALIDATE_DOCUMENT_TYPE,
      pathPrefix: DEFAULT_REVALIDATE_DOCUMENT_TYPE,
      tagPrefix: DEFAULT_REVALIDATE_DOCUMENT_TYPE,
    });
  }

  return {
    endpointPath,
    delayMs,
    documentsByType,
    secretEnvVar,
    getDocument: (documentType) => documentsByType.get(documentType) ?? null,
  };
}

async function triggerRevalidation(
  slug: string,
  documentType: string,
  revalidationConfig: ResolvedRevalidationConfig,
): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const documentRevalidation = revalidationConfig.getDocument(documentType);
  if (!documentRevalidation) {
    return;
  }

  const payload: {
    tags: string[];
    paths: string[];
    secret?: string;
  } = {
    tags: [`${documentRevalidation.tagPrefix}:${slug}`],
    paths: [`/${documentRevalidation.pathPrefix}/${slug}`],
  };
  const revalidateSecret = normalizeNonEmptyString(
    (import.meta.env as Record<string, unknown>)[revalidationConfig.secretEnvVar],
  );
  if (revalidateSecret) {
    payload.secret = revalidateSecret;
  }

  const response = await fetch(revalidationConfig.endpointPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Failed to revalidate page cache (${response.status}).`);
  }
}

function createPostPublishRevalidateAction(
  originalAction: DocumentActionComponent,
  documentType: string,
  revalidationConfig: ResolvedRevalidationConfig,
): DocumentActionComponent {
  const wrappedAction: DocumentActionComponent = (props: DocumentActionProps) => {
    const originalResult = originalAction(props);
    if (!originalResult) {
      return originalResult;
    }

    const originalOnHandle = originalResult.onHandle;
    return {
      ...originalResult,
      onHandle: () => {
        originalOnHandle?.();

        const slug = getPostSlug(props.draft) ?? getPostSlug(props.published);
        if (!slug) {
          return;
        }

        window.setTimeout(() => {
          void triggerRevalidation(slug, documentType, revalidationConfig).catch(
            (error: unknown) => {
            console.error("[abObjectCloning] revalidation failed", {
              slug,
              documentType,
              documentId:
                getCanonicalDocumentId(props.id) ??
                getCanonicalDocumentId(props.draft?._id) ??
                getCanonicalDocumentId(props.published?._id),
              error,
            });
            },
          );
        }, revalidationConfig.delayMs);
      },
    };
  };

  wrappedAction.action = originalAction.action;
  return wrappedAction;
}

function areSameStringArrays(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function sanitizeHost(host: string): string {
  const sanitizedHost = host.replace(/\/+$/, "");
  const ingestionHostMatch = sanitizedHost.match(
    /^(https?:\/\/)([a-z0-9-]+)\.i\.posthog\.com$/i,
  );

  if (!ingestionHostMatch) {
    return sanitizedHost;
  }

  const [, protocol, region] = ingestionHostMatch;
  return `${protocol}${region}.posthog.com`;
}

function getSiblingPath(path: Path, fieldName: string): Path {
  return [...path.slice(0, -1), fieldName];
}

function extractPostHogFeatureFlags(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { results?: unknown[] }).results)
  ) {
    return (payload as { results: unknown[] }).results;
  }

  return [];
}

function getPostHogVariantCodes(featureFlag: unknown): string[] {
  const multivariateVariants =
    featureFlag &&
    typeof featureFlag === "object" &&
    (featureFlag as { filters?: { multivariate?: { variants?: unknown[] } } })
      .filters?.multivariate?.variants;

  if (!Array.isArray(multivariateVariants)) {
    return [];
  }

  // Convention: first variant is treated as control and should not be cloned.
  const variantsWithoutControl = multivariateVariants.slice(1);

  return Array.from(
    new Set(
      variantsWithoutControl
        .map((variant) =>
          typeof variant === "object" && variant
            ? (variant as { key?: unknown }).key
            : undefined,
        )
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function toAbFeatureFlag(featureFlag: unknown): AbFeatureFlag | null {
  if (!featureFlag || typeof featureFlag !== "object") {
    return null;
  }

  const rawId = (featureFlag as { key?: unknown }).key;
  if (typeof rawId !== "string" || !rawId.trim()) {
    return null;
  }

  const variantCodes = getPostHogVariantCodes(featureFlag);
  if (variantCodes.length === 0) {
    return null;
  }

  const rawName = (featureFlag as { name?: unknown }).name;

  return {
    id: rawId.trim(),
    name: typeof rawName === "string" ? rawName.trim() : undefined,
    variantCodes,
  };
}

export function createPostHogAbTestAdapter(
  options: PostHogAdapterOptions | undefined,
): AbTestAdapter | undefined {
  const host = options?.host?.trim();
  const projectId = options?.projectId?.trim();
  const personalApiKey = options?.personalApiKey?.trim();

  if (!host || !projectId || !personalApiKey) {
    return undefined;
  }

  const normalizedHost = sanitizeHost(host);

  return {
    sourceName: "PostHog",
    loadFeatureFlags: async () => {
      const url = `${normalizedHost}/api/projects/${encodeURIComponent(
        projectId,
      )}/feature_flags?limit=100`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${personalApiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch PostHog feature flags (${response.status}).`,
        );
      }

      const payload = (await response.json()) as unknown;
      const featureFlags = extractPostHogFeatureFlags(payload)
        .map(toAbFeatureFlag)
        .filter((featureFlag): featureFlag is AbFeatureFlag =>
          Boolean(featureFlag),
        );

      return featureFlags;
    },
  };
}

function AbTestFeatureFlagInput(
  props: StringInputProps & { adapter?: AbTestAdapter },
) {
  const { onChange, value, path, adapter, renderDefault } = props;
  if (!adapter) {
    return renderDefault(props);
  }

  const client = useClient({ apiVersion: DEFAULT_STUDIO_API_VERSION });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [featureFlags, setFeatureFlags] = useState<AbFeatureFlag[]>([]);
  const [isSyncingVariants, setIsSyncingVariants] = useState(false);
  const variantCodesPath = useMemo(
    () => getSiblingPath(path, AB_TEST_VARIANT_CODES_FIELD_NAME),
    [path],
  );
  const documentIdValue = useFormValue(["_id"]);
  const documentId =
    typeof documentIdValue === "string" && documentIdValue.trim()
      ? documentIdValue
      : undefined;
  const currentVariantCodes = normalizeNonEmptyStrings(
    useFormValue(variantCodesPath),
  );
  const selectedFlagId = typeof value === "string" ? value : "";
  const selectedFlag = useMemo(
    () => featureFlags.find((featureFlag) => featureFlag.id === selectedFlagId),
    [featureFlags, selectedFlagId],
  );

  useEffect(() => {
    let isCancelled = false;

    setIsLoading(true);
    setLoadError(null);

    void adapter
      .loadFeatureFlags()
      .then((flags) => {
        if (isCancelled) {
          return;
        }

        setFeatureFlags(flags);
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : "Failed to load feature flags from adapter.",
        );
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [adapter]);

  useEffect(() => {
    if (!adapter || !selectedFlag) {
      return;
    }

    if (areSameStringArrays(currentVariantCodes, selectedFlag.variantCodes)) {
      return;
    }

    if (!documentId) {
      return;
    }

    setIsSyncingVariants(true);
    void client
      .patch(documentId)
      .set({ [AB_TEST_VARIANT_CODES_FIELD_NAME]: selectedFlag.variantCodes })
      .commit()
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Failed to sync variant codes.",
        );
      })
      .finally(() => setIsSyncingVariants(false));
  }, [adapter, client, currentVariantCodes, documentId, selectedFlag]);

  return (
    <Stack space={3}>
      <Select
        value={selectedFlagId}
        disabled={isLoading || featureFlags.length === 0}
        onChange={(event) => {
          const nextId = event.currentTarget.value;
          const nextSelectedFlag = featureFlags.find(
            (featureFlag) => featureFlag.id === nextId,
          );

          if (!nextSelectedFlag) {
            return;
          }

          onChange(set(nextSelectedFlag.id));
        }}
      >
        <option value="">
          {isLoading
            ? "Loading feature flags..."
            : featureFlags.length === 0
              ? "No multivariate feature flags found"
              : "Select a feature flag ID"}
        </option>
        {featureFlags.map((featureFlag) => (
          <option key={featureFlag.id} value={featureFlag.id}>
            {featureFlag.id}
            {featureFlag.name ? ` (${featureFlag.name})` : ""}
          </option>
        ))}
      </Select>

      <Text muted size={1}>
        Source: {adapter.sourceName}. Selecting an ID auto-syncs variant codes.
      </Text>
      {selectedFlag ? (
        <Text muted size={1}>
          Synced variants: {selectedFlag.variantCodes.join(", ")}
        </Text>
      ) : null}
      {isSyncingVariants ? (
        <Text muted size={1}>
          Syncing variants...
        </Text>
      ) : null}
      {loadError ? (
        <Card tone="critical" padding={2} radius={2}>
          <Text size={1}>{loadError}</Text>
        </Card>
      ) : null}
    </Stack>
  );
}

function createAbTestType(abTestTypeName: string, adapter?: AbTestAdapter) {
  return defineType({
    name: abTestTypeName,
    title: "AB Test",
    type: "document",
    fields: [
      defineField({
        name: "name",
        title: "Name",
        type: "string",
        validation: (rule) => rule.required(),
      }),
      defineField({
        name: AB_TEST_ID_FIELD_NAME,
        title: "ID",
        type: "string",
        description: adapter
          ? "Feature flag ID sourced from adapter."
          : "Unique identifier for this AB test.",
        validation: (rule) => rule.required(),
        components: {
          input: (props) =>
            React.createElement(AbTestFeatureFlagInput, {
              ...props,
              adapter,
            }),
        },
      }),
      defineField({
        name: AB_TEST_VARIANT_CODES_FIELD_NAME,
        title: "Variant Codes",
        type: "array",
        of: [{ type: "string" }],
        description: adapter
          ? "Auto-filled from selected feature flag variants."
          : "List of variant codes (for example: variant_1, variant_2).",
        readOnly: Boolean(adapter),
        validation: (rule) => rule.required().min(1),
      }),
    ],
  });
}

function isAbControlFieldPath(
  path: Path,
  fieldNames: ReturnType<typeof resolveAbFieldNames>,
): boolean {
  const lastSegment = path[path.length - 1];
  return (
    typeof lastSegment === "string" &&
    (lastSegment === fieldNames.toggle ||
      lastSegment === fieldNames.variants ||
      lastSegment === fieldNames.testRef)
  );
}

function createConfigureAbVariantFieldAction(
  fieldNames: ReturnType<typeof resolveAbFieldNames>,
) {
  return defineDocumentFieldAction({
    name: "abObjectCloning/configureVariant",
    useAction: ({ path, schemaType }) => ({
      type: "action",
      hidden:
        isAbControlFieldPath(path, fieldNames) ||
        (!hasAbFields(schemaType, fieldNames) && !isFieldLevelCloneCandidate(path)),
      title: "Configure AB variant",
      onAction: () => {
        if (typeof window === "undefined") {
          return;
        }

        const isObjectLevelAction = hasAbFields(schemaType, fieldNames);
        const targetPath = isObjectLevelAction ? path : path.slice(0, -1);

        window.dispatchEvent(
          new CustomEvent(AB_CONFIG_ACTION_EVENT_NAME, {
            detail: {
              targetPath,
            },
          }),
        );
      },
    }),
  });
}

function isFieldLevelCloneCandidate(path: Path): boolean {
  if (path.length < 1) {
    return false;
  }

  const lastSegment = path[path.length - 1];
  return typeof lastSegment === "string";
}

function hasAbFields(
  schemaType: unknown,
  fieldNames: ReturnType<typeof resolveAbFieldNames>,
): boolean {
  const fields = (schemaType as { fields?: Array<{ name?: string }> })?.fields;
  if (!Array.isArray(fields)) {
    return false;
  }

  const names = new Set(fields.map((field) => field.name));
  return (
    names.has(fieldNames.toggle) &&
    names.has(fieldNames.variants)
  );
}

function hasAbFieldMembers(
  members: ObjectInputProps["members"],
  fieldNames: ReturnType<typeof resolveAbFieldNames>,
): boolean {
  const fieldMembers = members.filter((member) => member.kind === "field");
  const names = new Set(fieldMembers.map((member) => member.name));
  return (
    names.has(fieldNames.toggle) &&
    names.has(fieldNames.variants)
  );
}

const abObjectCloningPlugin = definePlugin<AbObjectCloningOptions | void>(
  (options) => {
    const resolvedOptions: AbObjectCloningOptions = options ?? {};
    const adapter =
      resolvedOptions.adapter ??
      createPostHogAbTestAdapter(resolvedOptions.posthog);
    const abTestTypeName =
      normalizeNonEmptyString(resolvedOptions.abTestTypeName) ??
      DEFAULT_AB_TEST_TYPE_NAME;
    const fieldNames = resolveAbFieldNames(resolvedOptions.fieldNames);
    const revalidationConfig = resolveRevalidationConfig(resolvedOptions.revalidation);
    const abTestType = createAbTestType(abTestTypeName, adapter);
    const configureAbVariantFieldAction =
      createConfigureAbVariantFieldAction(fieldNames);
    const abComposedObjectInput = createComposedObjectInput([
      createAbObjectCustomizer({
        abTestTypeName,
        fieldNames: resolvedOptions.fieldNames,
      }),
    ]);

    return {
      name: "abObjectCloning",
      document: {
        actions: (prev, context) => {
          if (!revalidationConfig) {
            return prev;
          }

          const schemaTypeName = getSchemaTypeName(context.schemaType);
          if (!schemaTypeName || !revalidationConfig.getDocument(schemaTypeName)) {
            return prev;
          }

          return prev.map((action) => {
            if (typeof action !== "function" || action.action !== "publish") {
              return action;
            }

            return createPostPublishRevalidateAction(action, schemaTypeName, revalidationConfig);
          });
        },
        unstable_fieldActions: (prev) => [
          ...prev.filter(
            (action) => action.name !== configureAbVariantFieldAction.name,
          ),
          configureAbVariantFieldAction,
        ],
      },
      schema: {
        types: (prev) => {
          const withAbTestType = prev.some(
            (schemaType) => getSchemaTypeName(schemaType) === abTestTypeName,
          )
            ? prev
            : [...prev, abTestType];

          return withAbTestType.map((schemaType) => {
            if (getSchemaTypeName(schemaType) === abTestTypeName) {
              return schemaType;
            }

            return withAbObject(schemaType, {
              abTestTypeName,
              fieldNames: resolvedOptions.fieldNames,
            });
          });
        },
      },
      form: {
        components: {
          input: (props) => {
            if (!isObjectInputProps(props)) {
              return props.renderDefault(props);
            }

            // Respect object schemas with explicit custom inputs.
            if (props.schemaType?.components?.input) {
              return props.renderDefault(props);
            }

            if (
              hasAbFieldMembers(props.members, fieldNames)
            ) {
              return React.createElement(abComposedObjectInput, props);
            }

            if (hasAbFields(props.schemaType, fieldNames)) {
              return React.createElement(abComposedObjectInput, props);
            }

            return props.renderDefault(props);
          },
        },
      },
    };
  },
);

export function abObjectCloning(options?: AbObjectCloningOptions) {
  return abObjectCloningPlugin(options);
}

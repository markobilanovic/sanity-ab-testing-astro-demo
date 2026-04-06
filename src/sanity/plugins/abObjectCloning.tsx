import React, { useEffect, useMemo, useState } from "react";
import { Select, Stack, Text } from "@sanity/ui";
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
  type SchemaTypeDefinition,
  type StringInputProps,
} from "sanity";
import { abObjectCustomizer } from "./abObjectCustomizer";
import { createComposedObjectInput } from "./ComposedObjectInput";
import { withAbObject } from "../schemaTypes/helpers/withAbObject";

const AB_TOGGLE_FIELD_NAME = "showAbVariant";
const AB_VARIANTS_FIELD_NAME = "abVariants";
const AB_TEST_REF_FIELD_NAME = "abTestRef";
const AB_TEST_TYPE_NAME = "abTest";
const AB_CONFIG_ACTION_EVENT_NAME = "abObjectCloning:openConfigDialog";
const AbComposedObjectInput = createComposedObjectInput([abObjectCustomizer]);

const AB_TEST_ID_FIELD_NAME = "id";
const AB_TEST_VARIANT_CODES_FIELD_NAME = "variantCodes";

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

type AbObjectCloningOptions = {
  adapter?: AbTestAdapter;
  posthog?: PostHogAdapterOptions;
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

  const client = useClient({ apiVersion: "2025-01-01" });
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
        <Text size={1} tone="critical">
          {loadError}
        </Text>
      ) : null}
    </Stack>
  );
}

function createAbTestType(adapter?: AbTestAdapter) {
  return defineType({
    name: AB_TEST_TYPE_NAME,
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

function isAbControlFieldPath(path: Path): boolean {
  const lastSegment = path[path.length - 1];
  return (
    typeof lastSegment === "string" &&
    (lastSegment === AB_TOGGLE_FIELD_NAME ||
      lastSegment === AB_VARIANTS_FIELD_NAME ||
      lastSegment === AB_TEST_REF_FIELD_NAME)
  );
}

const configureAbVariantFieldAction = defineDocumentFieldAction({
  name: "abObjectCloning/configureVariant",
  useAction: ({ path, schemaType }) => ({
    type: "action",
    hidden:
      isAbControlFieldPath(path) ||
      (!hasAbFields(schemaType) && !isFieldLevelCloneCandidate(path)),
    title: "Configure AB variant",
    onAction: () => {
      if (typeof window === "undefined") {
        return;
      }

      const isObjectLevelAction = hasAbFields(schemaType);
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

function isFieldLevelCloneCandidate(path: Path): boolean {
  if (path.length < 1) {
    return false;
  }

  const lastSegment = path[path.length - 1];
  return typeof lastSegment === "string";
}

function hasAbFields(schemaType: unknown): boolean {
  const fields = (schemaType as { fields?: Array<{ name?: string }> })?.fields;
  if (!Array.isArray(fields)) {
    return false;
  }

  const names = new Set(fields.map((field) => field.name));
  return (
    names.has(AB_TOGGLE_FIELD_NAME) &&
    names.has(AB_VARIANTS_FIELD_NAME)
  );
}

function hasAbFieldMembers(
  members: Array<{ kind?: string; name?: string }>,
): boolean {
  const fieldMembers = members.filter((member) => member.kind === "field");
  const names = new Set(fieldMembers.map((member) => member.name));
  return (
    names.has(AB_TOGGLE_FIELD_NAME) &&
    names.has(AB_VARIANTS_FIELD_NAME)
  );
}

export const abObjectCloning = definePlugin<AbObjectCloningOptions | void>(
  (options) => {
    const resolvedOptions = (options ?? {}) as AbObjectCloningOptions;
    const adapter =
      resolvedOptions.adapter ??
      createPostHogAbTestAdapter(resolvedOptions.posthog);
    const abTestType = createAbTestType(adapter);

    return {
      name: "abObjectCloning",
      document: {
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
            (schemaType) =>
              (schemaType as { name?: string }).name === AB_TEST_TYPE_NAME,
          )
            ? prev
            : [...prev, abTestType];

          return withAbTestType.map((schemaType) => {
            if ((schemaType as { name?: string }).name === AB_TEST_TYPE_NAME) {
              return schemaType;
            }

            return withAbObject(
              schemaType as unknown as Record<string, unknown>,
            ) as unknown as SchemaTypeDefinition;
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

            if (hasAbFields(props.schemaType)) {
              return React.createElement(AbComposedObjectInput, props);
            }

            if (
              hasAbFieldMembers(
                props.members as Array<{ kind?: string; name?: string }>,
              )
            ) {
              return React.createElement(AbComposedObjectInput, props);
            }

            // Mount composed input for other objects too so field-level AB action
            // can be handled when the parent is the document root.
            return React.createElement(AbComposedObjectInput, props);
          },
        },
      },
    };
  },
);

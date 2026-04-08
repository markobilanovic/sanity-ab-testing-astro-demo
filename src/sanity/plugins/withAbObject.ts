import {
  AB_INTERNAL_OPTION,
  AB_VARIANTS_DISABLE_ACTIONS,
  DEFAULT_AB_TEST_TYPE_NAME,
  resolveAbFieldLabels,
  resolveAbFieldNames,
  type AbFieldLabelOverrides,
  type AbFieldNameOverrides,
} from "./abConfig";

type UnknownRecord = Record<string, unknown>;
type AnyField = Record<string, unknown> & {
  name?: string;
  type?: string;
  title?: string;
  fields?: AnyField[];
  of?: AnyField[];
  options?: unknown;
};

export type WithAbObjectOptions = {
  abTestTypeName?: string;
  fieldNames?: AbFieldNameOverrides;
  labels?: AbFieldLabelOverrides;
};

function transformNestedCollections(
  field: AnyField,
  config: WithAbObjectOptions,
): AnyField {
  const transformed: AnyField = { ...field };

  if (Array.isArray(field.fields)) {
    transformed.fields = field.fields.map((nestedField) =>
      transformField(nestedField, config),
    );
  }

  if (Array.isArray(field.of)) {
    transformed.of = field.of.map((nestedType) => transformField(nestedType, config));
  }

  return transformed;
}

function createAbToggleField(options: WithAbObjectOptions): AnyField {
  const fieldNames = resolveAbFieldNames(options.fieldNames);
  const labels = resolveAbFieldLabels(options.labels);

  return {
    name: fieldNames.toggle,
    title: labels.toggle,
    type: "boolean",
    initialValue: false,
  };
}

function createAbTestRefField(options: WithAbObjectOptions): AnyField {
  const fieldNames = resolveAbFieldNames(options.fieldNames);
  const labels = resolveAbFieldLabels(options.labels);

  return {
    name: fieldNames.testRef,
    title: labels.testRef,
    type: "reference",
    to: [{ type: options.abTestTypeName ?? DEFAULT_AB_TEST_TYPE_NAME }],
    options: {
      [AB_INTERNAL_OPTION]: true,
    },
  };
}

function createAbVariantsField(
  fields: AnyField[],
  options: WithAbObjectOptions,
): AnyField {
  const fieldNames = resolveAbFieldNames(options.fieldNames);
  const labels = resolveAbFieldLabels(options.labels);

  return {
    name: fieldNames.variants,
    title: labels.variants,
    type: "array",
    options: {
      [AB_INTERNAL_OPTION]: true,
      disableActions: AB_VARIANTS_DISABLE_ACTIONS,
    },
    of: [
      {
        name: fieldNames.variantEntryType,
        title: labels.variantEntry,
        type: "object",
        options: {
          [AB_INTERNAL_OPTION]: true,
        },
        preview: {
          select: {
            title: fieldNames.variantCode,
          },
        },
        fields: [
          {
            name: fieldNames.testName,
            title: labels.testName,
            type: "string",
            readOnly: true,
            options: {
              [AB_INTERNAL_OPTION]: true,
            },
          },
          {
            name: fieldNames.variantCode,
            title: labels.variantCode,
            type: "string",
            readOnly: true,
            options: {
              [AB_INTERNAL_OPTION]: true,
            },
          },
          {
            name: fieldNames.variant,
            title: labels.variant,
            type: "object",
            options: {
              [AB_INTERNAL_OPTION]: true,
            },
            fields,
          },
        ],
      },
    ],
  };
}

function hasAbControlFields(fields: AnyField[]): boolean {
  const abFieldNames = resolveAbFieldNames();
  const fieldNames = new Set(fields.map((field) => field.name));
  return (
    fieldNames.has(abFieldNames.toggle) ||
    fieldNames.has(abFieldNames.variants) ||
    fieldNames.has(abFieldNames.testRef)
  );
}

function transformAbContainerField(
  field: AnyField,
  config: WithAbObjectOptions,
): AnyField {
  const fieldOptions = (field.options ?? {}) as UnknownRecord;

  if (fieldOptions[AB_INTERNAL_OPTION]) {
    return transformNestedCollections(field, config);
  }

  const originalFields = Array.isArray(field.fields) ? field.fields : [];
  const transformedBaseFields = originalFields.map((nestedField) =>
    transformField(nestedField, config),
  );

  const transformed: AnyField = {
    ...field,
    fields: transformedBaseFields,
    options: {
      ...fieldOptions,
    },
  };

  if (hasAbControlFields(transformedBaseFields)) {
    return transformed;
  }

  const abVariantFields = originalFields.map((nestedField) =>
    transformField(nestedField, config),
  );

  transformed.fields = [
    ...transformedBaseFields,
    createAbToggleField(config),
    createAbTestRefField(config),
    createAbVariantsField(abVariantFields, config),
  ];

  return transformed;
}

function transformField(field: AnyField, options: WithAbObjectOptions): AnyField {
  if (field.type === "object" || field.type === "document") {
    return transformAbContainerField(field, options);
  }

  return transformNestedCollections(field, options);
}

/**
 * Adds AB clone controls to an object field:
 * - showAbVariant: boolean toggle
 * - abVariants: duplicate payloads for AB variants
 *
 * Usage:
 * `defineField(withAbObject({ name: "settings", type: "object", fields: [...] }))`
 */
export function withAbObject<TField extends object>(
  field: TField,
  options: WithAbObjectOptions = {},
): TField {
  return transformField(field as unknown as AnyField, options) as TField;
}

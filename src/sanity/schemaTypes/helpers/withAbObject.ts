const AB_TOGGLE_FIELD_NAME = "showAbVariant";
const AB_VARIANTS_FIELD_NAME = "abVariants";
const AB_TEST_REF_FIELD_NAME = "abTestRef";
const AB_INTERNAL_OPTION = "__abInternal";

type UnknownRecord = Record<string, unknown>;
type AnyField = UnknownRecord & {
  name?: string;
  type?: string;
  title?: string;
  fields?: AnyField[];
  of?: AnyField[];
  options?: UnknownRecord;
  components?: UnknownRecord;
  initialValue?: unknown;
  readOnly?: boolean;
  preview?: UnknownRecord;
};

function transformNestedCollections(field: AnyField): AnyField {
  const transformed: AnyField = { ...field };

  if (Array.isArray(field.fields)) {
    transformed.fields = field.fields.map((nestedField) =>
      transformField(nestedField),
    );
  }

  if (Array.isArray(field.of)) {
    transformed.of = field.of.map((nestedType) => transformField(nestedType));
  }

  return transformed;
}

function createAbToggleField(): AnyField {
  return {
    name: AB_TOGGLE_FIELD_NAME,
    title: "Enable AB variant",
    type: "boolean",
    initialValue: false,
  };
}

function createAbTestRefField(): AnyField {
  return {
    name: AB_TEST_REF_FIELD_NAME,
    title: "AB Test",
    type: "reference",
    to: [{ type: "abTest" }],
    options: {
      [AB_INTERNAL_OPTION]: true,
    },
  };
}

function createAbVariantsField(fields: AnyField[]): AnyField {
  return {
    name: AB_VARIANTS_FIELD_NAME,
    title: "AB Variants",
    type: "array",
    options: {
      [AB_INTERNAL_OPTION]: true,
    },
    of: [
      {
        name: "abVariantEntry",
        title: "AB Variant Entry",
        type: "object",
        options: {
          [AB_INTERNAL_OPTION]: true,
        },
        preview: {
          select: {
            title: "variantCode",
          },
        },
        fields: [
          {
            name: "variantCode",
            title: "Variant code",
            type: "string",
            readOnly: true,
            options: {
              [AB_INTERNAL_OPTION]: true,
            },
          },
          {
            name: "variant",
            title: "Variant content",
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
  const fieldNames = new Set(fields.map((field) => field.name));
  return (
    fieldNames.has(AB_TOGGLE_FIELD_NAME) ||
    fieldNames.has(AB_VARIANTS_FIELD_NAME) ||
    fieldNames.has(AB_TEST_REF_FIELD_NAME)
  );
}

function transformObjectField(field: AnyField): AnyField {
  const options = (field.options ?? {}) as UnknownRecord;

  if (options[AB_INTERNAL_OPTION]) {
    return transformNestedCollections(field);
  }

  const originalFields = Array.isArray(field.fields) ? field.fields : [];
  const transformedBaseFields = originalFields.map((nestedField) =>
    transformField(nestedField),
  );

  const transformed: AnyField = {
    ...field,
    fields: transformedBaseFields,
    options: {
      ...options,
    },
  };

  if (hasAbControlFields(transformedBaseFields)) {
    return transformed;
  }

  const abVariantFields = originalFields.map((nestedField) =>
    transformField(nestedField),
  );

  transformed.fields = [
    ...transformedBaseFields,
    createAbToggleField(),
    createAbTestRefField(),
    createAbVariantsField(abVariantFields),
  ];

  return transformed;
}

function transformField(field: AnyField): AnyField {
  if (field.type === "object") {
    return transformObjectField(field);
  }

  return transformNestedCollections(field);
}

/**
 * Adds AB clone controls to an object field:
 * - showAbVariant: boolean toggle
 * - abVariants: duplicate payloads for AB variants
 *
 * Usage:
 * `defineField(withAbObject({ name: "settings", type: "object", fields: [...] }))`
 */
export function withAbObject<TField extends AnyField>(field: TField): TField {
  return transformField(field) as TField;
}

const AB_TOGGLE_FIELD_NAME = "showAbVariant";
const AB_VARIANT_FIELD_NAME = "abVariant";
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

function createAbVariantField(fields: AnyField[]): AnyField {
  return {
    name: AB_VARIANT_FIELD_NAME,
    title: "AB Variant (B)",
    type: "object",
    options: {
      [AB_INTERNAL_OPTION]: true,
    },
    fields,
  };
}

function hasAbControlFields(fields: AnyField[]): boolean {
  const fieldNames = new Set(fields.map((field) => field.name));
  return (
    fieldNames.has(AB_TOGGLE_FIELD_NAME) || fieldNames.has(AB_VARIANT_FIELD_NAME)
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
    createAbVariantField(abVariantFields),
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
 * - abVariant: duplicate object payload for variant B
 *
 * Usage:
 * `defineField(withAbObject({ name: "settings", type: "object", fields: [...] }))`
 */
export function withAbObject<TField extends AnyField>(field: TField): TField {
  return transformField(field) as TField;
}

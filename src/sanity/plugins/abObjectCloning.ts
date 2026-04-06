import React from "react";
import {
  defineField,
  defineType,
  defineDocumentFieldAction,
  definePlugin,
  isObjectInputProps,
  type Path,
  type SchemaTypeDefinition,
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

const abTestType = defineType({
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
      name: "id",
      title: "ID",
      type: "string",
      description: "Unique identifier for this AB test.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "variantCodes",
      title: "Variant Codes",
      type: "array",
      of: [{ type: "string" }],
      description:
        "List of variant codes (for example: variant_1, variant_2).",
      validation: (rule) => rule.required().min(1),
    }),
  ],
});

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

export const abObjectCloning = definePlugin({
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
});

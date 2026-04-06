import React from "react";
import {
  defineDocumentFieldAction,
  definePlugin,
  isObjectInputProps,
  type Path,
  type SchemaTypeDefinition,
} from "sanity";
import { abObjectCustomizer } from "../components/abObjectCustomizer";
import { createComposedObjectInput } from "../components/ComposedObjectInput";
import { withAbObject } from "../schemaTypes/helpers/withAbObject";

const AB_TOGGLE_FIELD_NAME = "showAbVariant";
const AB_VARIANT_FIELD_NAME = "abVariant";
const AB_CONFIG_ACTION_EVENT_NAME = "abObjectCloning:openConfigDialog";
const AbComposedObjectInput = createComposedObjectInput([abObjectCustomizer]);

function isAbControlFieldPath(path: Path): boolean {
  const lastSegment = path[path.length - 1];
  return (
    typeof lastSegment === "string" &&
    (lastSegment === AB_TOGGLE_FIELD_NAME || lastSegment === AB_VARIANT_FIELD_NAME)
  );
}

const configureAbVariantFieldAction = defineDocumentFieldAction({
  name: "abObjectCloning/configureVariant",
  useAction: ({ path, schemaType }) => ({
    type: "action",
    hidden: !hasAbFields(schemaType) || isAbControlFieldPath(path),
    title: "Configure AB variant",
    onAction: () => {
      if (typeof window === "undefined") {
        return;
      }

      window.dispatchEvent(
        new CustomEvent(AB_CONFIG_ACTION_EVENT_NAME, {
          detail: { path },
        }),
      );
    },
  }),
});

function hasAbFields(schemaType: unknown): boolean {
  const fields = (schemaType as { fields?: Array<{ name?: string }> })?.fields;
  if (!Array.isArray(fields)) {
    return false;
  }

  const names = new Set(fields.map((field) => field.name));
  return names.has(AB_TOGGLE_FIELD_NAME) && names.has(AB_VARIANT_FIELD_NAME);
}

function hasAbFieldMembers(
  members: Array<{ kind?: string; name?: string }>,
): boolean {
  const fieldMembers = members.filter((member) => member.kind === "field");
  const names = new Set(fieldMembers.map((member) => member.name));
  return names.has(AB_TOGGLE_FIELD_NAME) && names.has(AB_VARIANT_FIELD_NAME);
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
    types: (prev) =>
      prev.map(
        (schemaType) =>
          withAbObject(
            schemaType as unknown as Record<string, unknown>,
          ) as unknown as SchemaTypeDefinition,
      ),
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
          hasAbFields(props.schemaType) ||
          hasAbFieldMembers(
            props.members as Array<{ kind?: string; name?: string }>,
          )
        ) {
          return React.createElement(AbComposedObjectInput, props);
        }

        return props.renderDefault(props);
      },
    },
  },
});

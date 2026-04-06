import React from "react";
import {
  definePlugin,
  isObjectInputProps,
  type SchemaTypeDefinition,
} from "sanity";
import { abObjectCustomizer } from "../components/abObjectCustomizer";
import { createComposedObjectInput } from "../components/ComposedObjectInput";
import { withAbObject } from "../schemaTypes/helpers/withAbObject";

const AB_TOGGLE_FIELD_NAME = "showAbVariant";
const AB_VARIANT_FIELD_NAME = "abVariant";
const AbComposedObjectInput = createComposedObjectInput([abObjectCustomizer]);

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

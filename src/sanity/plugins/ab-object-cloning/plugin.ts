import React from "react";
import { definePlugin, isObjectInputProps } from "sanity";
import { DEFAULT_AB_TEST_TYPE_NAME, resolveAbFieldNames } from "../abConfig";
import { createAbObjectCustomizer } from "../ab-object-customizer";
import { createComposedObjectInput } from "../composed-object-input";
import { withAbObject } from "../withAbObject";
import {
  getSchemaTypeName,
  hasAbFieldMembers,
  hasAbFields,
  normalizeNonEmptyString,
} from "./helpers";
import { createPostHogAbTestAdapter } from "./posthogAdapter";
import { resolveRevalidationConfig, createPostPublishRevalidateAction } from "./revalidation";
import { createAbTestType } from "./schema";
import { createConfigureAbVariantFieldAction } from "./fieldActions";
import type { AbObjectCloningOptions } from "./types";

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

            if (hasAbFieldMembers(props.members, fieldNames)) {
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

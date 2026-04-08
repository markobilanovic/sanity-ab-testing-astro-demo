import { defineDocumentFieldAction, type Path } from "sanity";
import { AB_CONFIG_ACTION_EVENT_NAME } from "../abConfig";
import {
  hasAbFields,
  isAbControlFieldPath,
  isFieldLevelCloneCandidate,
} from "./helpers";
import type { AbFieldNames } from "./types";

export function createConfigureAbVariantFieldAction(fieldNames: AbFieldNames) {
  return defineDocumentFieldAction({
    name: "abObjectCloning/configureVariant",
    useAction: ({ path, schemaType }) => ({
      type: "action",
      hidden:
        isAbControlFieldPath(path as Path, fieldNames) ||
        (!hasAbFields(schemaType, fieldNames) &&
          !isFieldLevelCloneCandidate(path as Path)),
      title: "Configure AB variant",
      onAction: () => {
        if (typeof window === "undefined") {
          return;
        }

        const isObjectLevelAction = hasAbFields(schemaType, fieldNames);
        const targetPath = isObjectLevelAction ? path : path.slice(0, -1);
        const selectedFieldName = isObjectLevelAction
          ? undefined
          : typeof path[path.length - 1] === "string"
            ? path[path.length - 1]
            : undefined;

        window.dispatchEvent(
          new CustomEvent(AB_CONFIG_ACTION_EVENT_NAME, {
            detail: {
              targetPath,
              selectedFieldName,
            },
          }),
        );
      },
    }),
  });
}

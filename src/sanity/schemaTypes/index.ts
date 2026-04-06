import type { SchemaTypeDefinition } from "sanity";
import { postType } from "./post";
import { withAbObject } from "../plugins/withAbObject";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    withAbObject(
      postType as unknown as Record<string, unknown>,
    ) as unknown as SchemaTypeDefinition,
  ],
};

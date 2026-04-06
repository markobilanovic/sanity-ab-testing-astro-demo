import type { SchemaTypeDefinition } from "sanity";
import { abTestType } from "./abTest";
import { postType } from "./post";
import { withAbObject } from "./helpers/withAbObject";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [
    abTestType,
    withAbObject(
      postType as unknown as Record<string, unknown>,
    ) as unknown as SchemaTypeDefinition,
  ],
};

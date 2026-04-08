import type { SchemaTypeDefinition } from "sanity";
import { postType } from "./post";
import { pageType } from "./page";
import { withAbObject } from "../plugins/withAbObject";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [withAbObject(postType), withAbObject(pageType)],
};

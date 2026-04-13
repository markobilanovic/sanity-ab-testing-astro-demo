import type { SchemaTypeDefinition } from "sanity";
import { postType } from "./post";
import { pageType } from "./page";
import {withAbObject} from "sanity-plugin-ab-testing";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [withAbObject(postType), withAbObject(pageType)],
};

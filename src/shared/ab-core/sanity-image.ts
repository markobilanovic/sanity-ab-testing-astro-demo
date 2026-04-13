import {
  createImageUrlBuilder,
  type SanityImageSource,
} from "@sanity/image-url";
import type { SanityClient } from "sanity";

export function createUrlForImage(client: SanityClient) {
  const imageBuilder = createImageUrlBuilder(client);
  return (source: SanityImageSource) => imageBuilder.image(source);
}

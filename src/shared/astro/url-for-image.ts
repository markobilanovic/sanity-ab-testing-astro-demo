import { sanityClient } from "sanity:client";
import type { SanityImageSource } from "@sanity/image-url";
import { createUrlForImage } from "../ab-core/sanity-image";

const urlForImageBuilder = createUrlForImage(sanityClient);

export function urlForImage(source: SanityImageSource) {
  return urlForImageBuilder(source);
}

export const POST_SLUGS_QUERY = `*[_type == "post" && defined(slug.current)].slug.current`;
export const PAGE_SLUGS_QUERY = `*[_type == "page" && defined(slug.current)].slug.current`;

export const AB_TEST_VARIANT_ROUTES_QUERY = `*[_type == "abTest" && defined(id)]{
  _id,
  id,
  variantCodes,
  "referencedPosts": *[
    _type == "post" &&
    defined(slug.current) &&
    references(^._id)
  ]{
    slug
  },
  "referencedPages": *[
    _type == "page" &&
    defined(slug.current) &&
    references(^._id)
  ]{
    slug
  }
}`;

export const POST_BY_SLUG_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  _id,
  title,
  body,
  slug,
  relatedPostsSection{
    ...,
    title,
    "relatedPosts": relatedPosts[]->{
      _id,
      title,
      "slug": slug.current
    }
  },
  showAbVariant,
  abTestRef,
  abVariants
}`;

export const PAGE_BY_SLUG_QUERY = `*[_type == "page" && slug.current == $slug][0]{
  _id,
  title,
  body,
  slug,
  showAbVariant,
  abTestRef,
  abVariants
}`;

import { defineField, defineType } from "sanity";

export const postType = defineType({
  name: "post",
  title: "Post",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "publishedAt",
      title: "Published at",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: "postContext",
      title: "Post context",
      type: "object",
      description: "Simple post metadata that plugins can use later.",
      fields: [
        defineField({
          name: "category",
          title: "Category",
          type: "string",
        }),
        defineField({
          name: "audience",
          title: "Audience",
          type: "string",
        }),
        defineField({
          name: "seo",
          title: "SEO",
          type: "object",
          fields: [
            defineField({
              name: "metaTitle",
              title: "Meta title",
              type: "string",
            }),
            defineField({
              name: "metaDescription",
              title: "Meta description",
              type: "string",
            }),
            defineField({
              name: "metaKeywords",
              title: "Meta keywords",
              type: "array",
              of: [{ type: "string" }],
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: "relatedPostsSection",
      title: "Related posts section",
      type: "object",
      fields: [
        defineField({
          name: "title",
          title: "Title",
          type: "string",
        }),
        defineField({
          name: "relatedPosts",
          title: "Related posts",
          type: "array",
          of: [{ type: "reference", to: [{ type: "post" }] }],
        }),
      ],
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      of: [
        { type: "block" },
        {
          type: "image",
          options: { hotspot: true },
          fields: [{ name: "alt", title: "Alternative text", type: "string" }],
        },
      ],
    }),
  ],
});

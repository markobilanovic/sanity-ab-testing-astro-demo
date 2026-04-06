import { defineField, defineType } from "sanity";

export const abTestType = defineType({
  name: "abTest",
  title: "AB Test",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "id",
      title: "ID",
      type: "string",
      description: "Unique identifier for this AB test.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "variantCodes",
      title: "Variant Codes",
      type: "array",
      of: [{ type: "string" }],
      description:
        "List of variant codes (for example: control, variant_1, variant_2).",
      initialValue: ["control", "variant_1", "variant_2"],
      validation: (rule) => rule.required().min(1),
    }),
  ],
});

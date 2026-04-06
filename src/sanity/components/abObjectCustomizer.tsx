import { Stack, Text } from "@sanity/ui";
import { MemberField, type ObjectInputProps } from "sanity";
import type { ObjectInputCustomizer } from "./ComposedObjectInput";

const AB_TOGGLE_FIELD_NAME = "showAbVariant";
const AB_VARIANT_FIELD_NAME = "abVariant";

function getFieldMemberByName(props: ObjectInputProps, fieldName: string) {
  return props.members.find(
    (member) => member.kind === "field" && member.name === fieldName,
  );
}

export const abObjectCustomizer: ObjectInputCustomizer = {
  matchField: (member) => member.name === AB_TOGGLE_FIELD_NAME,
  getClaimedFieldNames: () => [AB_TOGGLE_FIELD_NAME, AB_VARIANT_FIELD_NAME],
  render: (props) => {
    const {
      renderInput,
      renderField,
      renderItem,
      renderPreview,
      renderBlock,
      renderInlineBlock,
      renderAnnotation,
      value,
    } = props;

    const toggleField = getFieldMemberByName(props, AB_TOGGLE_FIELD_NAME);
    const abVariantField = getFieldMemberByName(props, AB_VARIANT_FIELD_NAME);
    const shouldShowAbVariant = Boolean(
      value &&
        typeof value === "object" &&
        AB_TOGGLE_FIELD_NAME in value &&
        (value as { showAbVariant?: boolean }).showAbVariant,
    );

    return (
      <Stack space={3}>
        {toggleField ? (
          <MemberField
            member={toggleField}
            renderInput={renderInput}
            renderField={renderField}
            renderItem={renderItem}
            renderPreview={renderPreview}
            renderBlock={renderBlock}
            renderInlineBlock={renderInlineBlock}
            renderAnnotation={renderAnnotation}
          />
        ) : null}

        {shouldShowAbVariant && abVariantField ? (
          <Stack space={2}>
            <Text muted size={1}>
              AB Variant (B)
            </Text>
            <MemberField
              member={abVariantField}
              renderInput={renderInput}
              renderField={renderField}
              renderItem={renderItem}
              renderPreview={renderPreview}
              renderBlock={renderBlock}
              renderInlineBlock={renderInlineBlock}
              renderAnnotation={renderAnnotation}
            />
          </Stack>
        ) : null}
      </Stack>
    );
  },
};

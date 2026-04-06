import { Fragment } from "react";
import type { ReactNode } from "react";
import { Stack } from "@sanity/ui";
import { MemberField, type FieldMember, type ObjectInputProps } from "sanity";

function isFieldMember(
  member: ObjectInputProps["members"][number],
): member is FieldMember {
  return member.kind === "field";
}

export type ObjectInputCustomizer = {
  matchField: (member: FieldMember) => boolean;
  getClaimedFieldNames: (member: FieldMember) => string[];
  render: (props: ObjectInputProps, member: FieldMember) => ReactNode;
};

type SlotDescriptor =
  | {
      key: string;
      type: "customizer";
      customizer: ObjectInputCustomizer;
      member: FieldMember;
    }
  | {
      key: string;
      type: "field";
      member: FieldMember;
    };

function getSlotDescriptors(
  fieldMembers: FieldMember[],
  customizers: ObjectInputCustomizer[],
): SlotDescriptor[] {
  return fieldMembers
    .reduce<{ rendered: Set<string>; slots: SlotDescriptor[] }>(
      (acc, member) => {
        if (acc.rendered.has(member.name)) {
          return acc;
        }

        const customizer = customizers.find((candidate) =>
          candidate.matchField(member),
        );
        if (customizer) {
          const claimedFieldNames = customizer.getClaimedFieldNames(member);

          return {
            rendered: new Set([...acc.rendered, ...claimedFieldNames]),
            slots: [
              ...acc.slots,
              {
                key: member.name,
                type: "customizer",
                customizer,
                member,
              },
            ],
          };
        }

        return {
          ...acc,
          slots: [...acc.slots, { key: member.name, type: "field", member }],
        };
      },
      { rendered: new Set<string>(), slots: [] },
    )
    .slots;
}

export function createComposedObjectInput(customizers: ObjectInputCustomizer[]) {
  return function ComposedObjectInput(props: ObjectInputProps) {
    const {
      members,
      renderInput,
      renderField,
      renderItem,
      renderPreview,
      renderBlock,
      renderInlineBlock,
      renderAnnotation,
    } = props;

    const fieldMembers = members.filter(isFieldMember);
    const slotDescriptors = getSlotDescriptors(fieldMembers, customizers);
    const matchedCustomizers = new Set(
      slotDescriptors
        .filter(
          (
            descriptor,
          ): descriptor is Extract<SlotDescriptor, { type: "customizer" }> =>
            descriptor.type === "customizer",
        )
        .map((descriptor) => descriptor.customizer),
    );
    const fallbackMember = fieldMembers[0];
    const unmatchedCustomizers = fallbackMember
      ? customizers.filter((customizer) => !matchedCustomizers.has(customizer))
      : [];

    return (
      <Stack space={4}>
        {slotDescriptors.map((descriptor) => (
          <Fragment key={descriptor.key}>
            {descriptor.type === "customizer" ? (
              descriptor.customizer.render(props, descriptor.member)
            ) : (
              <MemberField
                member={descriptor.member}
                renderInput={renderInput}
                renderField={renderField}
                renderItem={renderItem}
                renderPreview={renderPreview}
                renderBlock={renderBlock}
                renderInlineBlock={renderInlineBlock}
                renderAnnotation={renderAnnotation}
              />
            )}
          </Fragment>
        ))}
        {unmatchedCustomizers.map((customizer, index) => (
          <Fragment key={`unmatched-customizer-${index}`}>
            {customizer.render(props, fallbackMember)}
          </Fragment>
        ))}
      </Stack>
    );
  };
}

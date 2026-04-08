import type { FieldMember } from "sanity";
import type { ObjectInputCustomizer, SlotDescriptor } from "./types";

export function isFieldMember(
  member: { kind: string },
): member is FieldMember {
  return member.kind === "field";
}

export function getSlotDescriptors(
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

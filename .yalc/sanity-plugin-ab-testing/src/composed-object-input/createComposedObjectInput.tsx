import {Stack} from '@sanity/ui'
import {Fragment} from 'react'
import {MemberField, type ObjectInputProps} from 'sanity'

import {getSlotDescriptors, isFieldMember} from './slotDescriptors'
import type {ObjectInputCustomizer, SlotDescriptor} from './types'

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
    } = props
    const memberRenderProps = {
      renderInput,
      renderField,
      renderItem,
      renderPreview,
      renderBlock,
      renderInlineBlock,
      renderAnnotation,
    }

    const fieldMembers = members.filter(isFieldMember)
    const slotDescriptors = getSlotDescriptors(fieldMembers, customizers)
    const matchedCustomizers = new Set(
      slotDescriptors
        .filter(
          (descriptor): descriptor is Extract<SlotDescriptor, {type: 'customizer'}> =>
            descriptor.type === 'customizer',
        )
        .map((descriptor) => descriptor.customizer),
    )
    const fallbackMember = fieldMembers[0]
    const unmatchedCustomizers = fallbackMember
      ? customizers.filter((customizer) => !matchedCustomizers.has(customizer))
      : []

    return (
      <Stack space={4}>
        {slotDescriptors.map((descriptor) => (
          <Fragment key={descriptor.key}>
            {descriptor.type === 'customizer' ? (
              descriptor.customizer.render(props, descriptor.member)
            ) : (
              <MemberField member={descriptor.member} {...memberRenderProps} />
            )}
          </Fragment>
        ))}
        {unmatchedCustomizers.map((customizer, index) => (
          <Fragment key={`unmatched-customizer-${index}`}>
            {customizer.render(props, fallbackMember)}
          </Fragment>
        ))}
      </Stack>
    )
  }
}

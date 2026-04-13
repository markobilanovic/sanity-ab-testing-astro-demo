import React from 'react'
import {defineField, defineType} from 'sanity'
import {AB_TEST_ID_FIELD_NAME, AB_TEST_VARIANT_CODES_FIELD_NAME} from './constants'
import {AbTestFeatureFlagInput} from './AbTestFeatureFlagInput'
import type {AbTestAdapter} from './types'

export function createAbTestType(abTestTypeName: string, adapter?: AbTestAdapter) {
  return defineType({
    name: abTestTypeName,
    title: 'AB Test',
    type: 'document',
    fields: [
      defineField({
        name: 'name',
        title: 'Name',
        type: 'string',
        validation: (rule) => rule.required(),
      }),
      defineField({
        name: AB_TEST_ID_FIELD_NAME,
        title: 'ID',
        type: 'string',
        description: adapter
          ? 'Feature flag ID sourced from adapter.'
          : 'Unique identifier for this AB test.',
        validation: (rule) => rule.required(),
        components: {
          input: (props) =>
            React.createElement(AbTestFeatureFlagInput, {
              ...props,
              adapter,
            }),
        },
      }),
      defineField({
        name: AB_TEST_VARIANT_CODES_FIELD_NAME,
        title: 'Variant Codes',
        type: 'array',
        of: [{type: 'string'}],
        description: adapter
          ? 'Auto-filled from selected feature flag variants.'
          : 'List of variant codes (for example: variant_1, variant_2).',
        readOnly: Boolean(adapter),
        validation: (rule) => rule.required().min(1),
      }),
    ],
  })
}

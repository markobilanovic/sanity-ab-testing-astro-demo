import {describe, expect, it} from 'vitest'
import React from 'react'

import {AB_TEST_ID_FIELD_NAME, AB_TEST_VARIANT_CODES_FIELD_NAME} from './constants'
import {createAbTestType} from './schema'
import type {AbTestAdapter} from './types'
import {AbTestFeatureFlagInput} from './AbTestFeatureFlagInput'

describe('createAbTestType', () => {
  it('builds schema with required fields', () => {
    const schema = createAbTestType('abTest') as any
    const fieldNames = schema.fields.map((field: any) => field.name)

    expect(fieldNames).toEqual(['name', AB_TEST_ID_FIELD_NAME, AB_TEST_VARIANT_CODES_FIELD_NAME])
  })

  it('uses adapter-driven descriptions and inputs', () => {
    const adapter: AbTestAdapter = {
      sourceName: 'TestAdapter',
      loadFeatureFlags: async () => [],
    }

    const schema = createAbTestType('abTest', adapter) as any
    const idField = schema.fields.find((field: any) => field.name === AB_TEST_ID_FIELD_NAME)
    const variantsField = schema.fields.find(
      (field: any) => field.name === AB_TEST_VARIANT_CODES_FIELD_NAME,
    )

    expect(idField.description).toBe('Feature flag ID sourced from adapter.')
    expect(variantsField.description).toBe('Auto-filled from selected feature flag variants.')
    expect(variantsField.readOnly).toBe(true)

    const element = idField.components.input({} as any) as React.ReactElement<any>
    expect(element.type).toBe(AbTestFeatureFlagInput)
    expect(element.props.adapter).toBe(adapter)
  })
})

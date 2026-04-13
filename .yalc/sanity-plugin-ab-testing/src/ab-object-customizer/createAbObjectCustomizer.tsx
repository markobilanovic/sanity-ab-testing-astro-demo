import {createElement} from 'react'
import {
  DEFAULT_AB_TEST_TYPE_NAME,
  resolveAbFieldNames,
  type AbFieldNameOverrides,
} from '../abConfig'
import type {ObjectInputCustomizer} from '../composed-object-input'
import {AbObjectCustomizerField} from './AbObjectCustomizerField'

export type AbObjectCustomizerOptions = {
  abTestTypeName?: string
  fieldNames?: AbFieldNameOverrides
}

export function createAbObjectCustomizer(
  options: AbObjectCustomizerOptions = {},
): ObjectInputCustomizer {
  const fieldNames = resolveAbFieldNames(options.fieldNames)
  const abTestTypeName = options.abTestTypeName ?? DEFAULT_AB_TEST_TYPE_NAME

  return {
    matchField: (member) => member.name === fieldNames.toggle,
    getClaimedFieldNames: () => [fieldNames.toggle, fieldNames.variants, fieldNames.testRef],
    render: (props) =>
      createElement(AbObjectCustomizerField, {
        props,
        fieldNames,
        abTestTypeName,
      }),
  }
}

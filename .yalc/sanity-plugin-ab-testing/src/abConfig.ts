export const DEFAULT_AB_TEST_TYPE_NAME = 'abTest'
export const AB_CONFIG_ACTION_EVENT_NAME = 'abObjectCloning:openConfigDialog'
export const AB_INTERNAL_OPTION = '__abInternal'
export const AB_SELECTED_VARIANT_FIELDS_FIELD_NAME = 'abSelectedVariantFields'
export const AB_VARIANTS_DISABLE_ACTIONS = [
  'add',
  'addBefore',
  'addAfter',
  'remove',
  'duplicate',
] as const
export const DEFAULT_STUDIO_API_VERSION = '2025-01-01'

export const DEFAULT_AB_FIELD_NAMES = {
  toggle: 'showAbVariant',
  variants: 'abVariants',
  variant: 'variant',
  variantEntryType: 'abVariantEntry',
  variantCode: 'variantCode',
  testRef: 'abTestRef',
  testName: 'abTestName',
} as const

export type AbFieldNames = typeof DEFAULT_AB_FIELD_NAMES

export type AbFieldNameOverrides = Partial<AbFieldNames>

export function resolveAbFieldNames(overrides?: AbFieldNameOverrides): AbFieldNames {
  return {
    ...DEFAULT_AB_FIELD_NAMES,
    ...(overrides ?? {}),
  }
}

export const DEFAULT_AB_FIELD_LABELS = {
  toggle: 'Enable AB variant',
  testRef: 'AB Test',
  variants: 'AB Variants',
  variantEntry: 'AB Variant Entry',
  testName: 'AB test name',
  variantCode: 'Variant code',
  variant: 'Variant content',
} as const

export type AbFieldLabels = typeof DEFAULT_AB_FIELD_LABELS

export type AbFieldLabelOverrides = Partial<AbFieldLabels>

export function resolveAbFieldLabels(overrides?: AbFieldLabelOverrides): AbFieldLabels {
  return {
    ...DEFAULT_AB_FIELD_LABELS,
    ...(overrides ?? {}),
  }
}

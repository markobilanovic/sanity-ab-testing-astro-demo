import {AB_SELECTED_VARIANT_FIELDS_FIELD_NAME} from '../abConfig'

export type AbTestDocument = {
  _id: string
  name?: string
  variantCodes?: string[]
}

export type AbVariantItem = {
  _key: string
  _type: string
  abTestName: string
  variantCode: string
  variant: Record<string, unknown> & {
    [AB_SELECTED_VARIANT_FIELDS_FIELD_NAME]?: string[]
  }
}

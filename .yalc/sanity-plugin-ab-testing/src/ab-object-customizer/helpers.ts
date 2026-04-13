import type {FieldMember, ObjectInputProps} from 'sanity'
import {resolveAbFieldNames} from '../abConfig'

export function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

export function getControlVariantSeed(
  valueRecord: Record<string, unknown> | undefined,
  fieldNames: ReturnType<typeof resolveAbFieldNames>,
): Record<string, unknown> {
  if (!valueRecord) {
    return {}
  }

  const controlEntries = Object.entries(valueRecord).filter(
    ([key]) =>
      key !== fieldNames.toggle &&
      key !== fieldNames.variants &&
      key !== fieldNames.variant &&
      key !== fieldNames.testRef,
  )

  return cloneValue(Object.fromEntries(controlEntries))
}

export function pathToKey(path: unknown): string {
  return JSON.stringify(path)
}

export function getFieldMemberByName(
  props: ObjectInputProps,
  fieldName: string,
): FieldMember | undefined {
  return props.members.find(
    (member): member is FieldMember => member.kind === 'field' && member.name === fieldName,
  )
}

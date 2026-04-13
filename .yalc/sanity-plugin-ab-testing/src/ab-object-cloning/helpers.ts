import type {Path} from 'sanity'
import type {AbFieldNames, DocumentLike, ObjectMembers} from './types'

export function normalizeNonEmptyStrings(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return []
  }

  return Array.from(
    new Set(
      input
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

export function normalizeNonEmptyString(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null
  }

  const trimmed = input.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function getCanonicalDocumentId(value: unknown): string | null {
  const id = normalizeNonEmptyString(value)
  if (!id) {
    return null
  }

  return id.startsWith('drafts.') ? id.slice('drafts.'.length) : id
}

export function getDocumentSlug(document: unknown): string | null {
  const slugValue = (document as DocumentLike | undefined)?.slug?.current
  return normalizeNonEmptyString(slugValue)
}

export function getSchemaTypeName(schemaType: unknown): string | null {
  if (typeof schemaType === 'string') {
    return normalizeNonEmptyString(schemaType)
  }

  return normalizeNonEmptyString((schemaType as {name?: unknown})?.name)
}

export function areSameStringArrays(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

export function getSiblingPath(path: Path, fieldName: string): Path {
  return [...path.slice(0, -1), fieldName]
}

export function isAbControlFieldPath(path: Path, fieldNames: AbFieldNames): boolean {
  const lastSegment = path[path.length - 1]
  return (
    typeof lastSegment === 'string' &&
    (lastSegment === fieldNames.toggle ||
      lastSegment === fieldNames.variants ||
      lastSegment === fieldNames.testRef)
  )
}

export function isFieldLevelCloneCandidate(path: Path): boolean {
  if (path.length < 1) {
    return false
  }

  const lastSegment = path[path.length - 1]
  return typeof lastSegment === 'string'
}

export function hasAbFields(schemaType: unknown, fieldNames: AbFieldNames): boolean {
  const fields = (schemaType as {fields?: Array<{name?: string}>})?.fields
  if (!Array.isArray(fields)) {
    return false
  }

  const names = new Set(fields.map((field) => field.name))
  return names.has(fieldNames.toggle) && names.has(fieldNames.variants)
}

export function hasAbFieldMembers(members: ObjectMembers, fieldNames: AbFieldNames): boolean {
  const fieldMembers = members.filter((member) => member.kind === 'field')
  const names = new Set(fieldMembers.map((member) => member.name))
  return names.has(fieldNames.toggle) && names.has(fieldNames.variants)
}

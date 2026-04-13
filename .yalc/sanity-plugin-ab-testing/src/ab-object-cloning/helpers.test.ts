import {describe, expect, it} from 'vitest'

import {resolveAbFieldNames} from '../abConfig'
import type {ObjectMembers} from './types'
import {
  areSameStringArrays,
  getCanonicalDocumentId,
  getDocumentSlug,
  getSchemaTypeName,
  getSiblingPath,
  hasAbFieldMembers,
  hasAbFields,
  isAbControlFieldPath,
  isFieldLevelCloneCandidate,
  normalizeNonEmptyString,
  normalizeNonEmptyStrings,
} from './helpers'

const fieldNames = resolveAbFieldNames()

describe('normalizeNonEmptyStrings', () => {
  it('filters, trims, and deduplicates strings', () => {
    expect(normalizeNonEmptyStrings(['  a ', 'b', '', '  ', 42, 'a', 'b', 'c '])).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('returns an empty array for non-array input', () => {
    expect(normalizeNonEmptyStrings('nope')).toEqual([])
  })
})

describe('normalizeNonEmptyString', () => {
  it('returns null for non-strings or empty strings', () => {
    expect(normalizeNonEmptyString(123)).toBeNull()
    expect(normalizeNonEmptyString('   ')).toBeNull()
  })

  it('returns trimmed string for valid input', () => {
    expect(normalizeNonEmptyString('  ok ')).toBe('ok')
  })
})

describe('getCanonicalDocumentId', () => {
  it('strips drafts prefix', () => {
    expect(getCanonicalDocumentId('drafts.abc123')).toBe('abc123')
  })

  it('returns null for empty values', () => {
    expect(getCanonicalDocumentId('   ')).toBeNull()
  })
})

describe('getDocumentSlug', () => {
  it('extracts current slug when present', () => {
    expect(getDocumentSlug({slug: {current: ' hello '}})).toBe('hello')
  })

  it('returns null when slug missing', () => {
    expect(getDocumentSlug({})).toBeNull()
  })
})

describe('getSchemaTypeName', () => {
  it('handles string or object schema type', () => {
    expect(getSchemaTypeName('post')).toBe('post')
    expect(getSchemaTypeName({name: 'page'})).toBe('page')
  })
})

describe('areSameStringArrays', () => {
  it('compares arrays by length and order', () => {
    expect(areSameStringArrays(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(areSameStringArrays(['a', 'b'], ['b', 'a'])).toBe(false)
  })
})

describe('getSiblingPath', () => {
  it('returns the sibling path for the provided field name', () => {
    expect(getSiblingPath(['settings', 'title', 0], 'variants')).toEqual([
      'settings',
      'title',
      'variants',
    ])
  })
})

describe('isAbControlFieldPath', () => {
  it('matches AB control fields', () => {
    expect(isAbControlFieldPath(['root', fieldNames.toggle], fieldNames)).toBe(true)
    expect(isAbControlFieldPath(['root', fieldNames.variants], fieldNames)).toBe(true)
    expect(isAbControlFieldPath(['root', fieldNames.testRef], fieldNames)).toBe(true)
    expect(isAbControlFieldPath(['root', 'other'], fieldNames)).toBe(false)
  })
})

describe('isFieldLevelCloneCandidate', () => {
  it('requires a string last segment', () => {
    expect(isFieldLevelCloneCandidate([])).toBe(false)
    expect(isFieldLevelCloneCandidate([{_key: 'x'}])).toBe(false)
    expect(isFieldLevelCloneCandidate(['title'])).toBe(true)
  })
})

describe('hasAbFields', () => {
  it('detects AB toggle + variants on schema fields', () => {
    const schemaType = {
      fields: [{name: fieldNames.toggle}, {name: fieldNames.variants}, {name: 'title'}],
    }

    expect(hasAbFields(schemaType, fieldNames)).toBe(true)
  })

  it('returns false when missing required fields', () => {
    expect(hasAbFields({fields: [{name: fieldNames.toggle}]}, fieldNames)).toBe(false)
  })
})

describe('hasAbFieldMembers', () => {
  it('detects AB fields from object members', () => {
    const members = [
      {kind: 'field', name: fieldNames.toggle},
      {kind: 'field', name: fieldNames.variants},
      {kind: 'item', name: 'ignored'},
    ] as unknown as ObjectMembers

    expect(hasAbFieldMembers(members, fieldNames)).toBe(true)
  })
})

// @vitest-environment jsdom
import {describe, expect, it, vi} from 'vitest'

import {AB_CONFIG_ACTION_EVENT_NAME, resolveAbFieldNames} from '../abConfig'
import {createConfigureAbVariantFieldAction} from './fieldActions'

vi.mock('sanity', () => ({
  defineDocumentFieldAction: (config: any) => config,
}))

const fieldNames = resolveAbFieldNames()

describe('createConfigureAbVariantFieldAction', () => {
  it('hides the action on AB control fields', () => {
    const action = createConfigureAbVariantFieldAction(fieldNames)
    const result = action.useAction({
      path: ['root', fieldNames.toggle],
      schemaType: {fields: []},
    } as any)

    expect(result.hidden).toBe(true)
  })

  it('hides the action when schema lacks AB fields and path is not field-level', () => {
    const action = createConfigureAbVariantFieldAction(fieldNames)
    const result = action.useAction({
      path: ['root', {_key: 'abc'}],
      schemaType: {fields: []},
    } as any)

    expect(result.hidden).toBe(true)
  })

  it('shows the action for field-level path even without AB fields', () => {
    const action = createConfigureAbVariantFieldAction(fieldNames)
    const result = action.useAction({
      path: ['root', 'title'],
      schemaType: {fields: []},
    } as any) as any

    expect(result.hidden).toBe(false)
  })

  it('dispatches config event with target path and selected field', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const action = createConfigureAbVariantFieldAction(fieldNames)

    const result = action.useAction({
      path: ['root', 'title'],
      schemaType: {fields: []},
    } as any) as any

    result.onAction()

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent
    expect(event.type).toBe(AB_CONFIG_ACTION_EVENT_NAME)
    expect(event.detail).toEqual({
      targetPath: ['root'],
      selectedFieldName: 'title',
    })

    dispatchSpy.mockRestore()
  })

  it('uses object-level target path when AB fields are present', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const action = createConfigureAbVariantFieldAction(fieldNames)

    const result = action.useAction({
      path: ['root', 'settings'],
      schemaType: {fields: [{name: fieldNames.toggle}, {name: fieldNames.variants}]},
    } as any) as any

    result.onAction()

    const event = dispatchSpy.mock.calls[0][0] as CustomEvent
    expect(event.detail).toEqual({
      targetPath: ['root', 'settings'],
      selectedFieldName: undefined,
    })

    dispatchSpy.mockRestore()
  })
})

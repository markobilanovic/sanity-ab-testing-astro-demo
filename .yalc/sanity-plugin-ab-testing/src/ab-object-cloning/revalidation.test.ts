// @vitest-environment jsdom
import {describe, expect, it, vi} from 'vitest'

import type {DocumentActionComponent} from 'sanity'

import {DEFAULT_REVALIDATE_DELAY_MS, DEFAULT_REVALIDATE_ENDPOINT_PATH} from './constants'
import {createPublishRevalidateAction, resolveRevalidationConfig} from './revalidation'

const baseConfig = resolveRevalidationConfig({
  documents: [
    {
      type: 'post',
      pathPrefix: '/blog/',
      tagPrefix: 'post',
    },
  ],
  endpointPath: '/api/revalidate',
  secretEnvVar: 'REVALIDATE_SECRET',
  delayMs: 50,
})

describe('resolveRevalidationConfig', () => {
  it('returns null when disabled', () => {
    expect(resolveRevalidationConfig(false)).toBeNull()
    expect(resolveRevalidationConfig(undefined)).toBeNull()
  })

  it('applies defaults and clamps delay', () => {
    const resolved = resolveRevalidationConfig({
      delayMs: -10,
    })

    expect(resolved?.endpointPath).toBe(DEFAULT_REVALIDATE_ENDPOINT_PATH)
    expect(resolved?.delayMs).toBe(0)
    expect(resolved?.secretEnvVar).toBe('SANITY_STUDIO_ASTRO_REVALIDATE_SECRET')
  })

  it('dedupes document configs by type', () => {
    const resolved = resolveRevalidationConfig({
      documents: [
        {type: 'post', pathPrefix: '/a', tagPrefix: 'one'},
        {type: 'post', pathPrefix: '/b', tagPrefix: 'two'},
        {type: '  '},
      ],
    })

    expect(resolved?.documentsByType.size).toBe(1)
    expect(resolved?.getDocument('post')?.pathPrefix).toBe('/a')
  })

  it('keeps default delay when input is not finite', () => {
    const resolved = resolveRevalidationConfig({
      delayMs: Number.NaN,
    })

    expect(resolved?.delayMs).toBe(DEFAULT_REVALIDATE_DELAY_MS)
  })
})

describe('createPublishRevalidateAction', () => {
  it('calls original onHandle and triggers fetch with payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true})
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()

    const originalOnHandle = vi.fn()
    const originalAction = Object.assign(() => ({label: 'Publish', onHandle: originalOnHandle}), {
      action: 'publish' as any,
    }) as DocumentActionComponent

    const action = createPublishRevalidateAction(originalAction, 'post', baseConfig!)

    const result = action({
      id: 'drafts.abc',
      draft: {_id: 'drafts.abc', slug: {current: 'hello-world'}},
      published: null,
    } as any)

    result?.onHandle?.()

    expect(originalOnHandle).toHaveBeenCalled()

    vi.runAllTimers()
    await Promise.resolve()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/revalidate')
    expect(options?.method).toBe('POST')
    const body = JSON.parse(options?.body as string)
    expect(body).toEqual({
      paths: ['/blog/hello-world'],
      tags: ['post:hello-world'],
      secret: 'REVALIDATE_SECRET',
    })

    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('skips fetch when slug is missing', () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true})
    vi.stubGlobal('fetch', fetchMock)

    const originalAction = Object.assign(() => ({label: 'Publish'}), {
      action: 'publish' as any,
    }) as DocumentActionComponent
    const action = createPublishRevalidateAction(originalAction, 'post', baseConfig!)

    const result = action({id: 'drafts.abc', draft: {}, published: null} as any)
    result?.onHandle?.()

    expect(fetchMock).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('skips fetch when document type is not configured', () => {
    const fetchMock = vi.fn().mockResolvedValue({ok: true})
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()

    const originalAction = Object.assign(() => ({label: 'Publish'}), {
      action: 'publish' as any,
    }) as DocumentActionComponent
    const action = createPublishRevalidateAction(originalAction, 'page', baseConfig!)

    const result = action({
      id: 'drafts.abc',
      draft: {_id: 'drafts.abc', slug: {current: 'hello-world'}},
      published: null,
    } as any)

    result?.onHandle?.()

    vi.runAllTimers()
    expect(fetchMock).not.toHaveBeenCalled()

    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
})

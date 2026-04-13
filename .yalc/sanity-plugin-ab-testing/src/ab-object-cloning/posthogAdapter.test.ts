import {describe, expect, it, vi} from 'vitest'

import {createPostHogAbTestAdapter} from './posthogAdapter'

describe('createPostHogAbTestAdapter', () => {
  it('returns undefined when options are incomplete', () => {
    expect(createPostHogAbTestAdapter(undefined)).toBeUndefined()
    expect(createPostHogAbTestAdapter({host: 'https://app.posthog.com'})).toBeUndefined()
    expect(
      createPostHogAbTestAdapter({
        host: 'https://app.posthog.com',
        projectId: '123',
      }),
    ).toBeUndefined()
  })

  it('normalizes ingestion hosts and filters multivariate variants', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            key: ' flag-1 ',
            name: ' Flag One ',
            filters: {
              multivariate: {
                variants: [{key: 'control'}, {key: ' A '}, {key: 'A'}, {key: ''}, {key: 123}],
              },
            },
          },
          {
            key: 'flag-2',
            filters: {
              multivariate: {
                variants: [{key: 'control'}, {key: 'B'}],
              },
            },
          },
          {
            key: 'flag-3',
            filters: {},
          },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const adapter = createPostHogAbTestAdapter({
      host: 'https://us.i.posthog.com/',
      projectId: 'proj 1',
      personalApiKey: 'secret',
    })

    expect(adapter?.sourceName).toBe('PostHog')

    const flags = await adapter?.loadFeatureFlags()
    expect(flags).toEqual([
      {id: 'flag-1', name: 'Flag One', variantCodes: ['A']},
      {id: 'flag-2', name: undefined, variantCodes: ['B']},
    ])

    expect(fetchMock).toHaveBeenCalledWith(
      'https://us.posthog.com/api/projects/proj%201/feature_flags?limit=100',
      {
        headers: {
          Authorization: 'Bearer secret',
        },
      },
    )

    vi.unstubAllGlobals()
  })

  it('throws on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    vi.stubGlobal('fetch', fetchMock)

    const adapter = createPostHogAbTestAdapter({
      host: 'https://app.posthog.com',
      projectId: 'proj',
      personalApiKey: 'secret',
    })

    await expect(adapter?.loadFeatureFlags()).rejects.toThrow(
      'Failed to fetch PostHog feature flags (500).',
    )

    vi.unstubAllGlobals()
  })
})

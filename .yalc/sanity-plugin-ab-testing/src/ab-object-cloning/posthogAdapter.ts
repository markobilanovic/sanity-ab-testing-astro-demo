import type {AbFeatureFlag, AbTestAdapter, PostHogAdapterOptions} from './types'

function sanitizeHost(host: string): string {
  const sanitizedHost = host.replace(/\/+$/, '')
  const ingestionHostMatch = sanitizedHost.match(/^(https?:\/\/)([a-z0-9-]+)\.i\.posthog\.com$/i)

  if (!ingestionHostMatch) {
    return sanitizedHost
  }

  const [, protocol, region] = ingestionHostMatch
  return `${protocol}${region}.posthog.com`
}

function extractPostHogFeatureFlags(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as {results?: unknown[]}).results)
  ) {
    return (payload as {results: unknown[]}).results
  }

  return []
}

function getPostHogVariantCodes(featureFlag: unknown): string[] {
  const multivariateVariants =
    featureFlag &&
    typeof featureFlag === 'object' &&
    (featureFlag as {filters?: {multivariate?: {variants?: unknown[]}}}).filters?.multivariate
      ?.variants

  if (!Array.isArray(multivariateVariants)) {
    return []
  }

  // Convention: first variant is treated as control and should not be cloned.
  const variantsWithoutControl = multivariateVariants.slice(1)

  return Array.from(
    new Set(
      variantsWithoutControl
        .map((variant) =>
          typeof variant === 'object' && variant ? (variant as {key?: unknown}).key : undefined,
        )
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

function toAbFeatureFlag(featureFlag: unknown): AbFeatureFlag | null {
  if (!featureFlag || typeof featureFlag !== 'object') {
    return null
  }

  const rawId = (featureFlag as {key?: unknown}).key
  if (typeof rawId !== 'string' || !rawId.trim()) {
    return null
  }

  const variantCodes = getPostHogVariantCodes(featureFlag)
  if (variantCodes.length === 0) {
    return null
  }

  const rawName = (featureFlag as {name?: unknown}).name

  return {
    id: rawId.trim(),
    name: typeof rawName === 'string' ? rawName.trim() : undefined,
    variantCodes,
  }
}

export function createPostHogAbTestAdapter(
  options: PostHogAdapterOptions | undefined,
): AbTestAdapter | undefined {
  const host = options?.host?.trim()
  const projectId = options?.projectId?.trim()
  const personalApiKey = options?.personalApiKey?.trim()

  if (!host || !projectId || !personalApiKey) {
    return undefined
  }

  const normalizedHost = sanitizeHost(host)

  return {
    sourceName: 'PostHog',
    loadFeatureFlags: async () => {
      const url = `${normalizedHost}/api/projects/${encodeURIComponent(
        projectId,
      )}/feature_flags?limit=100`
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${personalApiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch PostHog feature flags (${response.status}).`)
      }

      const payload = (await response.json()) as unknown
      const featureFlags = extractPostHogFeatureFlags(payload)
        .map(toAbFeatureFlag)
        .filter((featureFlag): featureFlag is AbFeatureFlag => Boolean(featureFlag))

      return featureFlags
    },
  }
}

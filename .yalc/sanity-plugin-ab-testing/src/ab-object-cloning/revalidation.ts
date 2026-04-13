import type {DocumentActionComponent, DocumentActionProps} from 'sanity'

import {DEFAULT_REVALIDATE_DELAY_MS, DEFAULT_REVALIDATE_ENDPOINT_PATH} from './constants'
import {getCanonicalDocumentId, getDocumentSlug, normalizeNonEmptyString} from './helpers'
import type {ResolvedRevalidationConfig, RevalidationConfig} from './types'

function buildRevalidationPath(pathPrefix: string | null, slug: string): string {
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  const normalizedPrefix = pathPrefix?.replace(/^\/+|\/+$/g, '') ?? ''

  return normalizedPrefix ? `/${normalizedPrefix}/${normalizedSlug}` : `/${normalizedSlug}`
}

export function resolveRevalidationConfig(
  config: RevalidationConfig | false | undefined,
): ResolvedRevalidationConfig | null {
  if (config === false || config === undefined) {
    return null
  }

  const endpointPath =
    normalizeNonEmptyString(config?.endpointPath) ?? DEFAULT_REVALIDATE_ENDPOINT_PATH
  const delayMs =
    typeof config?.delayMs === 'number' && Number.isFinite(config.delayMs)
      ? Math.max(0, config.delayMs)
      : DEFAULT_REVALIDATE_DELAY_MS
  const secretEnvVar =
    normalizeNonEmptyString(config?.secretEnvVar) ?? 'SANITY_STUDIO_ASTRO_REVALIDATE_SECRET'
  const configuredDocuments = Array.isArray(config?.documents) ? config.documents : []

  const documentsByType = new Map<
    string,
    {type: string; pathPrefix: string | null; tagPrefix: string | null}
  >()
  for (const documentConfig of configuredDocuments) {
    const type = normalizeNonEmptyString(documentConfig?.type)
    if (!type || documentsByType.has(type)) {
      continue
    }

    const pathPrefix = normalizeNonEmptyString(documentConfig.pathPrefix)
    const tagPrefix = normalizeNonEmptyString(documentConfig.tagPrefix)
    documentsByType.set(type, {
      type,
      pathPrefix,
      tagPrefix,
    })
  }

  return {
    endpointPath,
    delayMs,
    documentsByType,
    secretEnvVar,
    getDocument: (documentType) => documentsByType.get(documentType) ?? null,
  }
}

async function triggerRevalidation(
  slug: string,
  documentType: string,
  revalidationConfig: ResolvedRevalidationConfig,
): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }

  const documentRevalidation = revalidationConfig.getDocument(documentType)
  if (!documentRevalidation) {
    return
  }

  const payload: {
    tags?: string[]
    paths: string[]
    secret?: string
  } = {
    paths: [buildRevalidationPath(documentRevalidation.pathPrefix, slug)],
  }
  if (documentRevalidation.tagPrefix) {
    payload.tags = [`${documentRevalidation.tagPrefix}:${slug}`]
  }
  const revalidateSecret = normalizeNonEmptyString(revalidationConfig.secretEnvVar)
  if (revalidateSecret) {
    payload.secret = revalidateSecret
  }

  const response = await fetch(revalidationConfig.endpointPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`Failed to revalidate page cache (${response.status}).`)
  }
}

export function createPublishRevalidateAction(
  originalAction: DocumentActionComponent,
  documentType: string,
  revalidationConfig: ResolvedRevalidationConfig,
): DocumentActionComponent {
  const wrappedAction: DocumentActionComponent = (props: DocumentActionProps) => {
    const originalResult = originalAction(props)
    if (!originalResult) {
      return originalResult
    }

    const originalOnHandle = originalResult.onHandle
    return {
      ...originalResult,
      onHandle: () => {
        originalOnHandle?.()

        const slug = getDocumentSlug(props.draft) ?? getDocumentSlug(props.published)
        if (!slug) {
          return
        }

        window.setTimeout(() => {
          triggerRevalidation(slug, documentType, revalidationConfig).catch((error: unknown) => {
            console.error('[abObjectCloning] revalidation failed', {
              slug,
              documentType,
              documentId:
                getCanonicalDocumentId(props.id) ??
                getCanonicalDocumentId(props.draft?._id) ??
                getCanonicalDocumentId(props.published?._id),
              error,
            })
          })
        }, revalidationConfig.delayMs)
      },
    }
  }

  wrappedAction.action = originalAction.action
  return wrappedAction
}

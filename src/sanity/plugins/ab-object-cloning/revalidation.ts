import type {
  DocumentActionComponent,
  DocumentActionProps,
} from "sanity";
import {
  DEFAULT_REVALIDATE_DELAY_MS,
  DEFAULT_REVALIDATE_DOCUMENT_TYPE,
  DEFAULT_REVALIDATE_ENDPOINT_PATH,
} from "./constants";
import {
  getCanonicalDocumentId,
  getPostSlug,
  normalizeNonEmptyString,
} from "./helpers";
import type { RevalidationConfig, ResolvedRevalidationConfig } from "./types";

export function resolveRevalidationConfig(
  config: RevalidationConfig | false | undefined,
): ResolvedRevalidationConfig | null {
  if (config === false || config === undefined) {
    return null;
  }

  const endpointPath =
    normalizeNonEmptyString(config?.endpointPath) ?? DEFAULT_REVALIDATE_ENDPOINT_PATH;
  const delayMs =
    typeof config?.delayMs === "number" && Number.isFinite(config.delayMs)
      ? Math.max(0, config.delayMs)
      : DEFAULT_REVALIDATE_DELAY_MS;
  const secretEnvVar =
    normalizeNonEmptyString(config?.secretEnvVar) ??
    "SANITY_STUDIO_ASTRO_REVALIDATE_SECRET";
  const configuredDocuments = Array.isArray(config?.documents)
    ? config.documents
    : [];

  const documentsByType = new Map<
    string,
    { type: string; pathPrefix: string; tagPrefix: string }
  >();
  for (const documentConfig of configuredDocuments) {
    const type = normalizeNonEmptyString(documentConfig?.type);
    if (!type || documentsByType.has(type)) {
      continue;
    }

    const pathPrefix = normalizeNonEmptyString(documentConfig.pathPrefix) ?? type;
    const tagPrefix = normalizeNonEmptyString(documentConfig.tagPrefix) ?? type;
    documentsByType.set(type, {
      type,
      pathPrefix,
      tagPrefix,
    });
  }

  if (documentsByType.size === 0) {
    documentsByType.set(DEFAULT_REVALIDATE_DOCUMENT_TYPE, {
      type: DEFAULT_REVALIDATE_DOCUMENT_TYPE,
      pathPrefix: DEFAULT_REVALIDATE_DOCUMENT_TYPE,
      tagPrefix: DEFAULT_REVALIDATE_DOCUMENT_TYPE,
    });
  }

  return {
    endpointPath,
    delayMs,
    documentsByType,
    secretEnvVar,
    getDocument: (documentType) => documentsByType.get(documentType) ?? null,
  };
}

async function triggerRevalidation(
  slug: string,
  documentType: string,
  revalidationConfig: ResolvedRevalidationConfig,
): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const documentRevalidation = revalidationConfig.getDocument(documentType);
  if (!documentRevalidation) {
    return;
  }

  const payload: {
    tags: string[];
    paths: string[];
    secret?: string;
  } = {
    tags: [`${documentRevalidation.tagPrefix}:${slug}`],
    paths: [`/${documentRevalidation.pathPrefix}/${slug}`],
  };
  const revalidateSecret = normalizeNonEmptyString(
    (import.meta.env as Record<string, unknown>)[revalidationConfig.secretEnvVar],
  );
  if (revalidateSecret) {
    payload.secret = revalidateSecret;
  }

  const response = await fetch(revalidationConfig.endpointPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Failed to revalidate page cache (${response.status}).`);
  }
}

export function createPostPublishRevalidateAction(
  originalAction: DocumentActionComponent,
  documentType: string,
  revalidationConfig: ResolvedRevalidationConfig,
): DocumentActionComponent {
  const wrappedAction: DocumentActionComponent = (props: DocumentActionProps) => {
    const originalResult = originalAction(props);
    if (!originalResult) {
      return originalResult;
    }

    const originalOnHandle = originalResult.onHandle;
    return {
      ...originalResult,
      onHandle: () => {
        originalOnHandle?.();

        const slug = getPostSlug(props.draft) ?? getPostSlug(props.published);
        if (!slug) {
          return;
        }

        window.setTimeout(() => {
          void triggerRevalidation(slug, documentType, revalidationConfig).catch(
            (error: unknown) => {
              console.error("[abObjectCloning] revalidation failed", {
                slug,
                documentType,
                documentId:
                  getCanonicalDocumentId(props.id) ??
                  getCanonicalDocumentId(props.draft?._id) ??
                  getCanonicalDocumentId(props.published?._id),
                error,
              });
            },
          );
        }, revalidationConfig.delayMs);
      },
    };
  };

  wrappedAction.action = originalAction.action;
  return wrappedAction;
}

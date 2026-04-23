import type { AbDocumentType } from "../ab-routing/index.js";

export type AbRouteRequestTarget = {
  documentType: AbDocumentType;
  requestedSlug: string;
};

const RESERVED_ROOT_SEGMENTS = new Set([
  "post",
  "studio",
  "api",
  "_astro",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "sitemap-index.xml",
]);

export function getRequestedAbRoute(pathname: string): AbRouteRequestTarget | null {
  const postMatch = /^\/post\/([^/]+)\/?$/.exec(pathname);
  if (postMatch) {
    try {
      return {
        documentType: "post",
        requestedSlug: decodeURIComponent(postMatch[1]),
      };
    } catch {
      return { documentType: "post", requestedSlug: postMatch[1] };
    }
  }

  const pageMatch = /^\/([^/]+)\/?$/.exec(pathname);
  if (!pageMatch) {
    return null;
  }

  const pageSegment = pageMatch[1];
  if (!pageSegment || RESERVED_ROOT_SEGMENTS.has(pageSegment) || pageSegment.includes(".")) {
    return null;
  }

  try {
    return {
      documentType: "page",
      requestedSlug: decodeURIComponent(pageSegment),
    };
  } catch {
    return { documentType: "page", requestedSlug: pageSegment };
  }
}

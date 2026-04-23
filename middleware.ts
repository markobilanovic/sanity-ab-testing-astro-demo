import { next, rewrite } from "@vercel/functions";
import { AB_TEST_VARIANT_ROUTES_QUERY } from "./src/shared/ab-core/ab-routing/queries";
import type { AbTestRouteSource } from "./src/shared/ab-core/ab-routing/types";
import { decideAbRewrite } from "./src/shared/ab-core/middleware-core";
import {
  buildAbExperimentsByRouteKey,
  extractFeatureFlags,
  getRequestedAbRoute,
} from "./src/shared/ab-core/ab-experiments";

const AB_TEST_CACHE_TTL_MS = 60_000;
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const DISTINCT_ID_COOKIE_NAME = "ph_distinct_id";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
const EDGE_MIDDLEWARE_HEADER = "x-ab-edge-middleware";
const EDGE_DISTINCT_ID_HEADER = "x-ab-distinct-id";

type AbTestCache = {
  fetchedAt: number;
  tests: AbTestRouteSource[];
};

let abTestCache: AbTestCache | null = null;

function getCookieValue(cookieHeader: string | null, cookieName: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const prefix = `${cookieName}=`;
  for (const token of cookieHeader.split(";")) {
    const trimmed = token.trim();
    if (!trimmed.startsWith(prefix)) {
      continue;
    }

    return decodeURIComponent(trimmed.slice(prefix.length));
  }

  return undefined;
}

function serializeDistinctIdCookie(distinctId: string, isHttps: boolean): string {
  const securePart = isHttps ? "; Secure" : "";
  return `${DISTINCT_ID_COOKIE_NAME}=${encodeURIComponent(distinctId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ONE_YEAR_IN_SECONDS}${securePart}`;
}

function responseHeadersWithOptionalSetCookie({
  setCookieHeaderValue,
  sawCookieDistinctId,
}: {
  setCookieHeaderValue?: string;
  sawCookieDistinctId: boolean;
}): Headers | undefined {
  const headers = new Headers();
  headers.set(EDGE_MIDDLEWARE_HEADER, "1");
  headers.set("x-ab-cookie-seen", sawCookieDistinctId ? "1" : "0");
  headers.set("x-ab-distinct-source", sawCookieDistinctId ? "cookie" : "generated");
  if (setCookieHeaderValue) {
    headers.append("set-cookie", setCookieHeaderValue);
  }
  return headers;
}

function forwardedRequestHeaders(request: Request, distinctId: string): Headers {
  const headers = new Headers(request.headers);
  headers.set(EDGE_MIDDLEWARE_HEADER, "1");
  headers.set(EDGE_DISTINCT_ID_HEADER, distinctId);
  return headers;
}

async function getAbTestsFromSanity(): Promise<AbTestRouteSource[]> {
  const projectId = process.env.PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_API_READ_TOKEN;
  if (!projectId || !dataset || !token) {
    return [];
  }

  const queryUrl = new URL(
    `https://${projectId}.api.sanity.io/v2025-01-28/data/query/${dataset}`,
  );
  queryUrl.searchParams.set("query", AB_TEST_VARIANT_ROUTES_QUERY);

  const response = await fetch(queryUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { result?: unknown };
  return Array.isArray(data.result) ? (data.result as AbTestRouteSource[]) : [];
}

async function getAbTestsCached(): Promise<AbTestRouteSource[]> {
  const now = Date.now();
  if (abTestCache && now - abTestCache.fetchedAt <= AB_TEST_CACHE_TTL_MS) {
    return abTestCache.tests;
  }

  const tests = await getAbTestsFromSanity();
  abTestCache = {
    fetchedAt: now,
    tests,
  };
  return tests;
}

async function getPosthogFlags(distinctId: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    return {};
  }

  const host = process.env.POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST;
  const flagsUrl = new URL("/flags", host);
  flagsUrl.searchParams.set("v", "3");

  const response = await fetch(flagsUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "vercel-edge-ab-middleware/1.0",
    },
    body: JSON.stringify({
      api_key: apiKey,
      distinct_id: distinctId,
    }),
  });

  if (!response.ok) {
    return {};
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return payload;
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  const requestedRoute = getRequestedAbRoute(pathname);
  if (!requestedRoute) {
    return next();
  }

  const cookieHeader = request.headers.get("cookie");
  const cookieDistinctId = getCookieValue(cookieHeader, DISTINCT_ID_COOKIE_NAME);
  const distinctId = cookieDistinctId ?? crypto.randomUUID();
  const setCookieHeaderValue = cookieDistinctId
    ? undefined
    : serializeDistinctIdCookie(distinctId, url.protocol === "https:");
  const requestHeaders = forwardedRequestHeaders(request, distinctId);

  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    return next({
      request: { headers: requestHeaders },
      headers: responseHeadersWithOptionalSetCookie({
        setCookieHeaderValue,
        sawCookieDistinctId: Boolean(cookieDistinctId),
      }),
    });
  }

  try {
    const [abTests, posthogFlagsPayload] = await Promise.all([
      getAbTestsCached(),
      getPosthogFlags(distinctId),
    ]);

    const featureFlags = extractFeatureFlags(posthogFlagsPayload);
    const abExperimentsByRouteKey = buildAbExperimentsByRouteKey(abTests, featureFlags);
    const rewriteDecision = decideAbRewrite({
      pathname,
      abTests,
      featureFlags,
      abExperimentsByRouteKey,
    });

    if (!rewriteDecision.rewrittenPath) {
      return next({
        request: { headers: requestHeaders },
        headers: responseHeadersWithOptionalSetCookie({
          setCookieHeaderValue,
          sawCookieDistinctId: Boolean(cookieDistinctId),
        }),
      });
    }

    const rewrittenUrl = new URL(request.url);
    rewrittenUrl.pathname = rewriteDecision.rewrittenPath;
    return rewrite(rewrittenUrl, {
      request: { headers: requestHeaders },
      headers: responseHeadersWithOptionalSetCookie({
        setCookieHeaderValue,
        sawCookieDistinctId: Boolean(cookieDistinctId),
      }),
    });
  } catch (error) {
    console.error("[vercel-middleware][posthog] rewrite failed", {
      path: pathname,
      message: error instanceof Error ? error.message : String(error),
    });
    return next({
      request: { headers: requestHeaders },
      headers: responseHeadersWithOptionalSetCookie({
        setCookieHeaderValue,
        sawCookieDistinctId: Boolean(cookieDistinctId),
      }),
    });
  }
}

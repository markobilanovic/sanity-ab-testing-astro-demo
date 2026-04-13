# Next.js adapters for shared A/B core

This repo now centralizes A/B routing, experiment logic, and revalidation parsing in:

- `src/shared/ab-core/`

To reuse in a Next.js app, copy `src/shared/ab-core` into the new project
or publish it as a small internal package.

## Middleware (Next.js)

Note: Next.js `middleware.ts` runs on the Edge runtime. `posthog-node` is
Node-only, so replace it with a direct `fetch` to the PostHog `/decide` endpoint
or move flag assignment to another layer if you need Node APIs.

```ts
// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { PostHog } from "posthog-node";
import {
  decideAbRewrite,
  type AbFeatureFlags,
} from "./shared/ab-core/middleware-core";
import {
  extractFeatureFlags,
  getActiveFeatureFlags,
  buildAbExperimentsByRouteKey,
} from "./shared/ab-core/ab-experiments";
import { AB_TEST_VARIANT_ROUTES_QUERY } from "./shared/ab-core/ab-routing";
import { createClient } from "@sanity/client";

const AB_TEST_CACHE_TTL_MS = 60_000;
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const DISTINCT_ID_COOKIE_NAME = "ph_distinct_id";

const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  apiVersion: "2024-01-01",
  useCdn: false,
});

let posthogClient: PostHog | null = null;
let abTestCache:
  | {
      fetchedAt: number;
      tests: unknown[];
    }
  | null = null;

function getPosthogClient(): PostHog | null {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(apiKey, {
      host: process.env.POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST,
    });
  }

  return posthogClient;
}

async function getAbTests() {
  const now = Date.now();
  if (abTestCache && now - abTestCache.fetchedAt <= AB_TEST_CACHE_TTL_MS) {
    return abTestCache.tests;
  }

  const { result } = await sanityClient.fetch(AB_TEST_VARIANT_ROUTES_QUERY, {}, {
    filterResponse: false,
  });
  const tests = Array.isArray(result) ? result : [];
  abTestCache = { fetchedAt: now, tests };
  return tests;
}

export async function middleware(request: NextRequest) {
  const client = getPosthogClient();
  if (!client) {
    return NextResponse.next();
  }

  const cookieDistinctId = request.cookies.get(DISTINCT_ID_COOKIE_NAME)?.value;
  const distinctId = cookieDistinctId ?? crypto.randomUUID();

  const [abTests, posthogFlags] = await Promise.all([
    getAbTests(),
    client.getAllFlagsAndPayloads(distinctId),
  ]);

  const featureFlags: AbFeatureFlags = extractFeatureFlags(posthogFlags);
  const activeFeatureFlags = getActiveFeatureFlags(featureFlags);
  console.info("[middleware][posthog] active feature flags", {
    path: request.nextUrl.pathname,
    distinctId,
    activeFeatureFlags,
  });

  const abExperimentsByRouteKey = buildAbExperimentsByRouteKey(abTests, featureFlags);
  const decision = decideAbRewrite({
    pathname: request.nextUrl.pathname,
    abTests,
    featureFlags,
    abExperimentsByRouteKey,
  });

  const response = decision.rewrittenPath
    ? NextResponse.rewrite(new URL(decision.rewrittenPath, request.url))
    : NextResponse.next();

  if (!cookieDistinctId) {
    response.cookies.set(DISTINCT_ID_COOKIE_NAME, distinctId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }

  return response;
}
```

## Revalidate route (Next.js App Router)

```ts
// app/api/revalidate/route.ts
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  parseRevalidateBody,
  type RevalidateBody,
} from "../../shared/ab-core/revalidate-core";

export async function POST(request: Request) {
  let body: RevalidateBody;
  try {
    body = (await request.json()) as RevalidateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = parseRevalidateBody(body, process.env.NEXT_REVALIDATE_SECRET);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.status });
  }

  for (const tag of parsed.request.tags) {
    revalidateTag(tag);
  }

  for (const path of parsed.request.paths) {
    revalidatePath(path);
  }

  return NextResponse.json({
    ok: true,
    invalidated: {
      tags: parsed.request.tags,
      paths: parsed.request.paths,
    },
  });
}
```

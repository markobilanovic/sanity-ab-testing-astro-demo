import type { APIRoute } from "astro";
import {
  parseRevalidateBody,
  type RevalidateBody,
} from "../../shared/ab-core/revalidate-core";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (!context.cache.enabled) {
    return Response.json(
      {
        ok: false,
        error:
          "Route caching is not enabled. Configure experimental.cache.provider in astro.config.",
      },
      { status: 503 },
    );
  }

  let body: RevalidateBody;
  try {
    body = (await context.request.json()) as RevalidateBody;
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const configuredSecret = import.meta.env.ASTRO_REVALIDATE_SECRET?.trim();
  const parsed = parseRevalidateBody(body, configuredSecret);
  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error }, { status: parsed.status });
  }

  const { tags, paths } = parsed.request;

  const invalidatedPaths: string[] = [];
  if (tags.length > 0) {
    await context.cache.invalidate({ tags });
  }

  for (const path of paths) {
    await context.cache.invalidate({ path });
    invalidatedPaths.push(path);
  }

  return Response.json({
    ok: true,
    invalidated: {
      tags,
      paths: invalidatedPaths,
    },
  });
};

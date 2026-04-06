import type { APIRoute } from "astro";

export const prerender = false;

type RevalidateBody = {
  secret?: unknown;
  tags?: unknown;
  paths?: unknown;
};

function normalizeNonEmptyStrings(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

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
  if (configuredSecret) {
    const providedSecret =
      typeof body.secret === "string" ? body.secret.trim() : "";
    if (!providedSecret || providedSecret !== configuredSecret) {
      return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
  }

  const tags = normalizeNonEmptyStrings(body.tags);
  const paths = normalizeNonEmptyStrings(body.paths);
  if (tags.length === 0 && paths.length === 0) {
    return Response.json(
      { ok: false, error: "Provide at least one cache tag or path." },
      { status: 400 },
    );
  }

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

export type RevalidateBody = {
  secret?: unknown;
  tags?: unknown;
  paths?: unknown;
};

export type RevalidateRequest = {
  tags: string[];
  paths: string[];
};

export type RevalidateParseResult =
  | { ok: true; request: RevalidateRequest }
  | { ok: false; status: number; error: string };

function normalizeNonEmptyStrings(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseRevalidateBody(
  body: RevalidateBody,
  configuredSecret?: string | null,
): RevalidateParseResult {
  const normalizedSecret = configuredSecret?.trim() || "";
  if (normalizedSecret) {
    const providedSecret = typeof body.secret === "string" ? body.secret.trim() : "";
    if (!providedSecret || providedSecret !== normalizedSecret) {
      return { ok: false, status: 401, error: "Unauthorized." };
    }
  }

  const tags = normalizeNonEmptyStrings(body.tags);
  const paths = normalizeNonEmptyStrings(body.paths);
  if (tags.length === 0 && paths.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Provide at least one cache tag or path.",
    };
  }

  return { ok: true, request: { tags, paths } };
}

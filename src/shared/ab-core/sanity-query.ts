export type SanityFetch = <T>(
  query: string,
  params?: Record<string, unknown>,
  options?: { filterResponse?: boolean },
) => Promise<{ result: T }>;

export async function loadQuery<QueryResponse>({
  fetch,
  query,
  params,
}: {
  fetch: SanityFetch;
  query: string;
  params?: Record<string, unknown>;
}) {
  const { result } = await fetch<QueryResponse>(query, params ?? {}, {
    filterResponse: false,
  });

  return {
    data: result,
  };
}

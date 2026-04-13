import type { QueryParams } from "sanity";
import { sanityClient } from "sanity:client";
import { loadQuery as coreLoadQuery } from "../ab-core/sanity-query";

export async function loadQuery<QueryResponse>({
  query,
  params,
}: {
  query: string;
  params?: QueryParams;
}) {
  return coreLoadQuery<QueryResponse>({
    fetch: sanityClient.fetch.bind(sanityClient),
    query,
    params,
  });
}

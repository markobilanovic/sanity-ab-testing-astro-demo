import type { ObjectInputProps } from "sanity";
import type { AbFieldNameOverrides } from "../abConfig";

export type AbFeatureFlag = {
  id: string;
  name?: string;
  variantCodes: string[];
};

export type AbTestAdapter = {
  sourceName: string;
  loadFeatureFlags: () => Promise<AbFeatureFlag[]>;
};

export type PostHogAdapterOptions = {
  host?: string;
  projectId?: string;
  personalApiKey?: string;
};

export type RevalidationDocumentConfig = {
  type?: string;
  pathPrefix?: string;
  tagPrefix?: string;
};

export type RevalidationConfig = {
  documents?: RevalidationDocumentConfig[];
  endpointPath?: string;
  secretEnvVar?: string;
  delayMs?: number;
};

export type ResolvedRevalidationDocumentConfig = {
  type: string;
  pathPrefix: string;
  tagPrefix: string;
};

export type ResolvedRevalidationConfig = {
  documentsByType: Map<string, ResolvedRevalidationDocumentConfig>;
  endpointPath: string;
  secretEnvVar: string;
  delayMs: number;
  getDocument: (documentType: string) => ResolvedRevalidationDocumentConfig | null;
};

export type AbObjectCloningOptions = {
  adapter?: AbTestAdapter;
  posthog?: PostHogAdapterOptions;
  abTestTypeName?: string;
  fieldNames?: AbFieldNameOverrides;
  revalidation?: RevalidationConfig | false;
};

export type PostDocumentLike = {
  _id?: string;
  slug?: { current?: string };
};

export type AbFieldNames = ReturnType<
  typeof import("../abConfig").resolveAbFieldNames
>;

export type ObjectMembers = ObjectInputProps["members"];

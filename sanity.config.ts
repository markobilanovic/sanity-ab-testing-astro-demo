import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schema } from "./src/sanity/schemaTypes";
import { abObjectCloning } from "./src/sanity/plugins/abObjectCloning";
import type { AbObjectCloningOptions } from "./src/sanity/plugins/abObjectCloning.tsx";

function readStudioEnv(name: string): string | undefined {
  const valueFromImportMeta = (
    import.meta.env as Record<string, string | undefined>
  )[name];
  const valueFromProcessEnv =
    typeof process !== "undefined" &&
    process?.env &&
    typeof process.env[name] === "string"
      ? process.env[name]
      : undefined;
  const value = valueFromImportMeta ?? valueFromProcessEnv;
  return value?.trim() ? value : undefined;
}

function requireStudioEnv(...names: string[]): string {
  for (const name of names) {
    const value = readStudioEnv(name);
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required environment variable: ${names.join(" or ")}`);
}

const abPluginOptions: AbObjectCloningOptions = {
  posthog: {
    host: readStudioEnv("SANITY_STUDIO_POSTHOG_HOST"),
    projectId: readStudioEnv("SANITY_STUDIO_POSTHOG_PROJECT_ID"),
    personalApiKey: readStudioEnv("SANITY_STUDIO_POSTHOG_PERSONAL_API_KEY"),
  },
  revalidation: {
    documentTypes: ["post"],
    endpointPath: "/api/revalidate",
  },
};

export default defineConfig({
  projectId: requireStudioEnv(
    "PUBLIC_SANITY_PROJECT_ID",
    "SANITY_STUDIO_PROJECT_ID",
  ),
  dataset: requireStudioEnv("PUBLIC_SANITY_DATASET", "SANITY_STUDIO_DATASET"),
  plugins: [
    structureTool(),
    abObjectCloning(abPluginOptions),
    visionTool(),
  ],
  schema,
});

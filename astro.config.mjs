// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sanity from "@sanity/astro";
import { loadEnv } from "vite";

const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET } = loadEnv(
  process.env.NODE_ENV ?? "development",
  process.cwd(),
  "",
);

// https://astro.build/config
export default defineConfig({
  output: "static",
  integrations: [
    sanity({
      projectId: PUBLIC_SANITY_PROJECT_ID || "your-project-id",
      dataset: PUBLIC_SANITY_DATASET || "production",
      useCdn: false,
      apiVersion: "2025-01-28",
      studioBasePath: "/studio",
    }),
    react(),
  ],
});

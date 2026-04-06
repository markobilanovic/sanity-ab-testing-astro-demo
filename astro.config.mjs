// @ts-check
import { defineConfig, memoryCache } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
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
  adapter: node({ mode: "standalone" }),
  experimental: {
    cache: {
      provider: memoryCache(),
    },
  },
  vite: {
    envPrefix: ["PUBLIC_", "SANITY_STUDIO_"],
  },
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

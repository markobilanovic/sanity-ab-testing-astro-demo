# Sanity AB Plugins

`abObjectCloning()` adds AB authoring controls to object and document schema types.

## Folder Structure

The plugin code is split by concern so each area can evolve independently:

- `ab-object-cloning/`: plugin composition, schema registration, adapter + revalidation integration.
- `ab-object-customizer/`: custom object input renderer and AB variant dialog state/behavior.
- `composed-object-input/`: reusable input composition layer for field customizers.
- `abConfig.ts`: shared constants and name/label override resolvers.
- `withAbObject.ts`: schema transformation utility that injects AB fields.
- `abObjectCloning.tsx`, `abObjectCustomizer.tsx`, `ComposedObjectInput.tsx`: compatibility entry points that re-export from new folders.

## Install in Studio

```ts
import { abObjectCloning } from "./src/sanity/plugins/abObjectCloning";

export default defineConfig({
  plugins: [
    abObjectCloning({
      posthog: {
        host: process.env.SANITY_STUDIO_POSTHOG_HOST,
        projectId: process.env.SANITY_STUDIO_POSTHOG_PROJECT_ID,
        personalApiKey: process.env.SANITY_STUDIO_POSTHOG_PERSONAL_API_KEY,
      },
      revalidation: {
        endpointPath: "/api/revalidate",
        documents: [
          {
            type: "post",
            pathPrefix: "post",
            tagPrefix: "post",
          },
        ],
      },
    }),
  ],
});
```

## Plugin Options

- `adapter`: custom feature-flag source for AB test IDs.
- `posthog`: built-in adapter config (used when `adapter` is not provided).
- `abTestTypeName`: AB test document type name (default: `abTest`).
- `fieldNames`: override AB control field names (`showAbVariant`, `abTestRef`, `abVariants`, ...).
- `revalidation`: optional publish hook config. No revalidation runs unless this is configured.
  - `documents`: list of per-document-type revalidation configs (`type`, optional `pathPrefix`, optional `tagPrefix`).
  - `endpointPath`: relative endpoint path called from Studio.
  - `secretEnvVar`: optional Studio env var name for a revalidation secret.
  - `delayMs`: delay before request to reduce publish/read race conditions.

## AB Field Shape

Fields injected into AB-enabled object/document containers:

- `showAbVariant`: boolean toggle
- `abTestRef`: reference to AB test document
- `abVariants`: array of variant entries
  - `abTestName`: read-only label
  - `variantCode`: read-only variant key
  - `variant`: cloned object payload matching the base object shape

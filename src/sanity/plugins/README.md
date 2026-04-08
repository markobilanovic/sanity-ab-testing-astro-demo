# Sanity AB Plugin

`abObjectCloning()` adds AB authoring controls to object/document schema types.

## Install in Studio

```ts
import { abObjectCloning } from "./src/sanity/plugins/abObjectCloning";

export default defineConfig({
  // ...
  plugins: [
    abObjectCloning({
      posthog: {
        host: process.env.SANITY_STUDIO_POSTHOG_HOST,
        projectId: process.env.SANITY_STUDIO_POSTHOG_PROJECT_ID,
        personalApiKey: process.env.SANITY_STUDIO_POSTHOG_PERSONAL_API_KEY,
      },
      revalidation: {
        documentTypes: ["post"],
        endpointPath: "/api/revalidate",
      },
    }),
  ],
});
```

## Options

- `adapter`: Custom feature-flag source for AB test IDs.
- `posthog`: Built-in adapter config (used when `adapter` is not provided).
- `abTestTypeName`: AB test document type name (default: `abTest`).
- `fieldNames`: Override AB control field names (defaults include `showAbVariant`, `abTestRef`, `abVariants`).
- `revalidation`: Optional publish hook config. No revalidation runs unless this is configured.
  - `documentTypes`: Document types that trigger revalidation.
  - `endpointPath`: Relative endpoint path to call from Studio.
  - `secretEnvVar`: Optional Studio env var name carrying a revalidation secret.
  - `delayMs`: Delay before request to reduce publish/read race conditions.
  - `tagPrefix` and `pathPrefix`: Prefixes used to build invalidation payloads.

## AB Field Shape

The plugin injects these fields into AB-enabled object/document containers:

- `showAbVariant`: boolean toggle
- `abTestRef`: reference to the AB test document
- `abVariants`: array of variant entries
  - `abTestName`: readonly label
  - `variantCode`: readonly variant key
  - `variant`: cloned object payload matching the base object shape

## Migration Note

Revalidation is now opt-in. If you relied on the old implicit publish revalidation behavior, add `revalidation` in your plugin options.

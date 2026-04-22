# Sanity + Astro AB Routing Demo

This project extends Sanity Studio with AB cloning controls, generates all AB route
combinations at build time, and rewrites incoming post URLs at runtime based on
active PostHog feature flags.

## What this project does

- **Sanity authoring with AB cloning:** the Studio plugin in `src/sanity/plugins`
  injects AB fields into document/object schemas so editors can define per-variant
  content copies.
- **Static generation of variant routes:** `src/pages/post/[slug].astro` and
  `src/pages/[slug].astro` build all valid route combinations (base document + AB
  variants) during `getStaticPaths`.
- **Runtime assignment via PostHog:** `src/middleware.ts` reads user flags and
  rewrites `/post/:slug` and root-level `/:slug` page routes to matching composite
  variant routes.
- **Variant content application:** `src/sanity/lib/ab-routing.ts` applies selected
  variant payloads recursively to the loaded Sanity document tree.

## Request flow

1. A user requests `/post/some-slug`.
2. `src/middleware.ts` resolves the visitor identity (`ph_distinct_id` cookie),
   fetches AB test metadata from Sanity, and reads active flags from PostHog.
3. Middleware maps active flags to experiments for that post and rewrites to a
   composite route slug like `/post/some-slug--expA-a--expB-b`.
4. `src/pages/post/[slug].astro` loads the canonical post, resolves AB contexts,
   and applies variant overrides before rendering.

If PostHog is not configured, requests fall back to canonical non-rewritten pages.

## Core AB files

- `src/sanity/plugins/abObjectCloning.tsx` - Studio plugin that provides AB cloning
  UI and publish/revalidation integration.
- `src/sanity/plugins/withAbObject.ts` - schema transformer that injects AB control
  fields (`showAbVariant`, `abTestRef`, `abVariants`).
- `src/sanity/lib/ab-routing.ts` - route generation/parsing, slug serialization,
  and deep variant application logic.
- `src/sanity/lib/ab-experiments.ts` - feature-flag extraction and mapping from
  PostHog assignments to post-level AB contexts.
- `src/middleware.ts` - runtime PostHog evaluation and Astro rewrites.
- `src/pages/post/[slug].astro` - static path generation and final variant-aware
  post rendering.

## Setup

### Prerequisites

- Node.js 22+
- Sanity account/project
- PostHog project (for runtime assignment in middleware)

### Environment

Copy environment variables:

```sh
cp .env.example .env
```

Initialize Sanity and write values into `.env`:

```sh
npx sanity@latest init --env .env
```

Important vars:

- `PUBLIC_SANITY_PROJECT_ID`
- `PUBLIC_SANITY_DATASET`
- `SANITY_API_READ_TOKEN`
- `POSTHOG_API_KEY` (required for middleware-based runtime rewriting)
- `POSTHOG_HOST` (optional; defaults to `https://us.i.posthog.com`)
- `SANITY_STUDIO_POSTHOG_HOST`
- `SANITY_STUDIO_POSTHOG_PROJECT_ID`
- `SANITY_STUDIO_POSTHOG_PERSONAL_API_KEY`

## Run locally

```sh
npm run dev
```

- Site: `http://localhost:4321`
- Studio: `http://localhost:4321/studio`

## Developing `sanity-plugin-ab-testing` locally

`package.json` always lists the **published** plugin
(`"sanity-plugin-ab-testing": "^0.1.0"`) — it never changes between modes.
"Local mode" just swaps `node_modules/sanity-plugin-ab-testing` for a
symlink to the plugin checkout at `../sanity-plugin-ab-testing`, so `git
status` stays clean no matter what you're doing.

### Switch to local plugin (one command)

From the **demo repo**:

```sh
npm run dev:plugin
```

That single command:

1. Builds `../sanity-plugin-ab-testing` (`npm run build` in the plugin repo).
2. Symlinks `node_modules/sanity-plugin-ab-testing` → the plugin checkout.
3. Starts the plugin build watcher (`pkg-utils watch`) and `astro dev`
   side-by-side with [concurrently](https://www.npmjs.com/package/concurrently).

Edit any file under `sanity-plugin-ab-testing/src/` and the demo picks up
the rebuilt `dist/` automatically. **You don't need to run anything from
inside the plugin repo** — the demo drives it.

### Switch back to the published plugin

```sh
npm run plugin:unlink
```

Removes the symlink, clears any stale yalc artifacts, and reinstalls
`sanity-plugin-ab-testing` from npm.

### Other helpers

```sh
npm run plugin:status    # LOCAL → /path  or  REMOTE (^0.1.0)
npm run plugin:link      # symlink only (no watch, no dev)
npm run plugin:watch     # rebuild plugin on file changes (standalone)
```

### Using a non-default plugin path

If the plugin checkout isn't at `../sanity-plugin-ab-testing`, set
`PLUGIN_REPO` (all the `plugin:*` scripts and `dev:plugin` respect it):

```sh
PLUGIN_REPO=~/code/sanity-plugin-ab-testing npm run dev:plugin
```

### Typical inner-loop

```sh
npm run dev:plugin          # start hacking (one terminal)
# ...edit plugin + demo code, hot reload in browser...
# Ctrl+C when done
npm run plugin:unlink       # only when you want to test against the npm build
```

## AB plugin docs

Plugin-specific API and options are documented in:

- `src/sanity/plugins/README.md`

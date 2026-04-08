---
name: Sanity Plugin Contribution Prep
overview: Prepare the AB plugin under src/sanity/plugins as a standalone, publishable Sanity ecosystem contribution with docs, packaging, and submission readiness.
todos:
  - id: extract-plugin-package
    content: Extract plugin code into a standalone package/repo with clean public exports
    status: pending
  - id: package-metadata
    content: Add npm-ready metadata and license for open-source publishing
    status: pending
  - id: public-docs
    content: Write publication-grade README with install/setup/options/examples
    status: pending
  - id: demo-validation
    content: Validate plugin in a fresh Studio demo and capture screenshots
    status: pending
  - id: release-submit
    content: Publish package and submit to Sanity ecosystem listing
    status: pending
isProject: false
---

# Sanity Ecosystem Contribution Plan

## Goal
Turn the AB Studio plugin currently embedded in this Astro app into a reusable, documented plugin that can be published and submitted to the Sanity ecosystem.

## What to Prepare

### 1) Split plugin code from app-specific code
- Extract plugin source from [src/sanity/plugins](src/sanity/plugins) into a standalone package/repo (or workspace package), keeping app runtime logic out.
- Keep the plugin focused on Studio behavior (`ab-object-cloning`, `ab-object-customizer`, `composed-object-input`, and `withAbObject`), while documenting optional integrations.
- Keep app-specific middleware/routing code in this app only (for example [src/middleware.ts](src/middleware.ts)).

### 2) Add package metadata required for npm distribution
- Update [package.json](package.json) for plugin publishing (new package name, clear description, repository URL, keywords, peer/dependency strategy for `sanity`, proper versioning).
- Add a permissive open-source license file (none exists currently).
- Ensure entrypoints are explicit and stable (the plugin should export a clean API from a single public module).

### 3) Harden public plugin docs
- Expand plugin docs from [src/sanity/plugins/README.md](src/sanity/plugins/README.md) into a public README that includes:
  - installation (`npm install ...`)
  - quick start (`defineConfig` plugin registration)
  - options reference and defaults
  - compatibility matrix (supported Sanity major versions)
  - limitations and security notes (e.g., how external adapters/revalidation secrets are handled)
- Keep one minimal copy/paste schema setup example and one advanced adapter/revalidation example.

### 4) Provide an example Studio/demo project
- Add a small reproducible demo (or keep this repo as demo and clearly mark plugin package location).
- Include seed/sample schema and expected editor flow so Sanity reviewers/community can validate behavior quickly.

### 5) Quality gates before release
- Add build/typecheck/test scripts for plugin package and run in CI.
- Verify plugin works in a fresh Sanity Studio install (outside this app).
- Confirm no private env vars or app-only assumptions are required by default.

### 6) Publish and submit ecosystem contribution
- Publish to npm.
- Submit as a Sanity ecosystem contribution (tools/plugins category) with:
  - package link
  - source repo link
  - screenshots/GIF of editor UX
  - concise value proposition and usage notes
- Track feedback and iterate quickly after first submission.

## Acceptance Criteria
- Plugin installs via npm in a clean Studio and registers without local app code.
- Public README enables first-use setup in <10 minutes.
- Contribution has source + docs + visuals and is ready for ecosystem listing review.

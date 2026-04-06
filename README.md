# Astro + Sanity (minimal starter)

Minimal Astro project with embedded Sanity Studio at `/studio` and a dynamic
post route at `/post/[slug]`.

## 1) Prerequisites

- Node.js 22+
- A Sanity account

## 2) Install and environment setup

Copy environment variables:

```sh
cp .env.example .env
```

Initialize Sanity and write values into `.env`:

```sh
npx sanity@latest init --env .env
```

This should populate:

- `PUBLIC_SANITY_PROJECT_ID`
- `PUBLIC_SANITY_DATASET`

## 3) Run the app

```sh
npm run dev
```

Open:

- Site: `http://localhost:4321`
- Studio: `http://localhost:4321/studio`

## 4) Create first post

In Studio, create a `Post` document:

- Set `Title`
- Generate `Slug`
- Add optional `Body`
- Publish

Then open `http://localhost:4321/post/<your-slug>`.

## Project notes

- Sanity integration config: `astro.config.mjs`
- Studio config: `sanity.config.ts`
- Schema: `src/sanity/schemaTypes`
- Query wrapper: `src/sanity/lib/load-query.ts`

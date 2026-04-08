# AB object cloning plugin

Use the `abObjectCloning()` plugin in `sanity.config.ts` to enable AB cloning
for all `type: "object"` fields automatically.

```ts
plugins: [structureTool(), abObjectCloning()];
```

## Stored shape

For each object field:

- `showAbVariant`: boolean toggle
- `abTestRef`: reference to the selected `abTest` document
- `abVariants`: array of variant entries
  - `abTestName`: readonly AB test display name
  - `variantCode`: readonly variant code
  - `variant`: object payload clone (same shape as the base object)

Turning the toggle off clears `abTestRef` and `abVariants`.

## GROQ example

```groq
*[_type == "post"]{
  title,
  postContext{
    category,
    audience,
    showAbVariant,
    abTestRef->{_id, name},
    abVariants[]{
      variantCode,
      variant{
        category,
        audience
      }
    },
  }
}
```

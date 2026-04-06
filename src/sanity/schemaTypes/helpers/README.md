# AB object cloning plugin

Use the `abObjectCloning()` plugin in `sanity.config.ts` to enable AB cloning
for all `type: "object"` fields automatically.

```ts
plugins: [structureTool(), abObjectCloning()];
```

## Stored shape

For each object field:

- `showAbVariant`: boolean toggle
- `abVariant`: object payload for variant B (same field shape as the base object)

Turning the toggle off hides the editor section for `abVariant` but does not clear data automatically.

## GROQ example

```groq
*[_type == "post"]{
  title,
  postContext{
    category,
    audience,
    showAbVariant,
    abVariant{
      category,
      audience
    }
  }
}
```

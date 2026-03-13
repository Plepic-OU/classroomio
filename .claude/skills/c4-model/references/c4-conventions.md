# C4 Model Conventions (Reference)

## Layer hierarchy

| Layer | Name | Question answered |
|---|---|---|
| 1 | System Context | What is the system and who uses it? |
| 2 | Container | What are the deployable/runnable units? |
| 3 | Component | How is each container structured internally? |

## Layer 3 granularity rules

- A **component** = a grouping of related functionality behind a well-defined interface (a directory, not a single file).
- Exclude: pure data/model types, shared utilities called everywhere, generated files.
- Include: route handlers, service modules, UI feature domains, middleware layers.
- In JavaScript/TypeScript: a directory with index exports or a cohesive set of files serving one responsibility.
- Rule of thumb for this codebase: if a directory has >3 non-trivial .ts files with a common concern, it's a component.

## Component naming

- Use the directory's last segment, title-cased, as the label.
- Add a short technology tag (TypeScript, Svelte/SvelteKit, Hono Router, Supabase Client, etc.).
- Description should state the *responsibility* in ≤8 words.

## Relationship labels

- Keep `Rel()` labels short: "Uses", "Calls", "Queries", "Sends via", "Stores via".
- Only draw relationships between components that are architecturally significant (not trivial utility imports).
- Omit relationships to `_root` components (top-level entry files).

## What NOT to diagram at Layer 3

- External systems (Supabase, OpenAI) — these appear at Layer 2.
- Individual files or functions.
- Circular relationships caused by shared type imports.

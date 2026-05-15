# C4 model — conventions used by this skill

Reference: <https://c4model.com/> (especially [/abstractions/component](https://c4model.com/abstractions/component)).

## The four layers

1. **Context** — the whole system as one box, plus the people/external systems it interacts with. Audience: anyone.
2. **Container** — decompose the system into deployable/runnable units (apps, services, databases, queues, single-page apps, mobile apps…). A container is **a separately running process or data store**, not a Docker image.
3. **Component** — decompose a single container into groupings of related functionality behind a well-defined interface. Components are **not separately deployable** — they all run in the same process as the container.
4. **Code** — class diagrams etc. Usually not maintained as a diagram; left to the IDE. This skill does not emit Layer 4.

## What counts as a "component"?

> "A grouping of related functionality encapsulated behind a well-defined interface." — c4model.com

Per-language interpretation:

- **JS/TS modules**: a directory of related modules (controllers + services + helpers that together implement one capability).
- **Procedural code**: related files in a directory.
- **OO code**: collections of classes/interfaces working together.

For this skill, a component **is a directory** at a configurable depth below `src/`. Files inside that directory (and any deeper sub-directories) belong to that component.

## What is NOT a component

- A package, namespace, or arbitrary folder grouping with no functional cohesion.
- A single class, function, or file.
- A JAR/DLL/assembly. (Packaging is orthogonal.)
- Third-party libraries. (Treated as edges to external systems if relevant, otherwise hidden.)

## Relationships

At Layer 3 a relationship between two components means: **one component's code calls or imports the other's**. The label should describe what the caller is asking for, not the implementation detail. Examples:

- "validates user" — auth middleware → user-validation util
- "renders" — route → component
- "queries" — service → database

This skill derives relationships from import edges. The default label is `"uses"`, with `count: N` metadata reflecting the number of distinct import edges. Edit `generate-diagrams.mjs` if you want richer labels.

## Granularity guidance

- 5-20 components per container is a sweet spot.
- If a container's diagram exceeds ~25 components, increase depth or merge sub-modules in the generator.
- If one component contains >50 files, depth is almost certainly too shallow.
- It's fine to leave very small one-off directories (1-2 files) as separate components — those are usually intentionally scoped helpers.

## Conventions specific to ClassroomIO

- Routes (`src/routes/...`) are exposed at the top of the diagram — they're the inbound surface.
- Stores, services, and utils sit in the middle.
- The Supabase client (`$lib/utils/supabase.ts` or `$src/utils/supabase.ts`) and `@cio/api` RPC client are drawn as edges to the external "Supabase" and "API" containers respectively when imported.
- The dashboard's `+server.ts` files under `src/routes/api/...` are internal SvelteKit endpoints, not the standalone `@cio/api` container — don't confuse them.

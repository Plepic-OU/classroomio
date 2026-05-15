# C4 Model Conventions

## Layers
- **L1 System Context** — the system in relation to external actors and systems
- **L2 Container** — deployable units inside the system (apps, databases, queues)
- **L3 Component** — logical groupings of code inside one container (not separately deployable)

## Granularity rules (L3)
- A component = cohesive functional unit behind a well-defined interface
- For JS/TS: directory groupings of modules. For Svelte: co-located .ts + .svelte files
- Target 5–20 components per container; too few = useless, too many = noisy
- If a single component contains >50 files, the grouping depth is too shallow

## Component depth for ClassroomIO
- **API** (`apps/api/src`): depth 1 — top-level directories (routes, services, middlewares, utils, types, config)
- **Dashboard** (`apps/dashboard/src`): depth 3 — e.g. `lib/components/Course`, `lib/utils/services`, `routes/org`

## Relationships
- Draw only **cross-component** relationships; internal calls are implementation detail
- Label with the nature of the call (reads, updates, emits, validates), not just "uses"
- If 3+ relationships exist between the same pair, consolidate with a summary label

## Svelte handling
- ts-morph cannot parse .svelte files; extract relationships from co-located .ts files
- Track svelteFileCount as metadata (counts .svelte files in the component's directory)
- Svelte stores ($lib/utils/store) are treated as a component that others import from

## Mermaid C4 limits
- Mermaid C4 is experimental; keep diagram node count under ~25 for readable output
- Use UpdateLayoutConfig to control shapes-per-row if diagram is wide
- Container_Boundary and System_Boundary are the only supported boundary types

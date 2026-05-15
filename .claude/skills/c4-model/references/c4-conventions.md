# C4 Model Conventions

Reference for generating ClassroomIO C4 diagrams.

## Abstraction levels

| Level | Diagram | Question answered |
|-------|---------|------------------|
| L1 | System Context | What is the system and who uses it? |
| L2 | Container | What high-level technology blocks make up the system? |
| L3 | Component | What are the major building blocks inside a container? |
| L4 | Code | How is a specific component implemented? (not generated here) |

## Component (L3) definition

A **component** is a grouping of related functionality behind a well-defined
interface. Key properties:

- Not separately deployable — all components in a container share a process.
- In JavaScript/TypeScript: logical groupings of modules and functions.
- **Do not** map 1:1 to directories; a component may span multiple modules or
  a directory may be too shallow to be meaningful.
- Filter out noise: pure data structures, trivial utilities, and generated code
  should not appear as their own components.

## ClassroomIO-specific conventions

**Dashboard components** (SvelteKit) are grouped at `src/` depth 3 by default,
capturing feature-level groupings like `lib/components/Course`,
`lib/utils/services`, `routes/api/courses`. Each Svelte component directory is a
sub-unit — the `.svelte` file count is shown but Svelte files are not parsed by
ts-morph.

**API components** (Hono.js) are grouped at `src/` depth 2, capturing
`routes/course`, `services/course`, `utils/auth`, `config`, `middlewares`.

## Relationship semantics

Relationships in L3 represent **TypeScript import statements** between component
directories. A higher count means more coupling between those components.
Self-loops are excluded. Relationships to external packages are excluded.

## Granularity check

If any single component contains >50 files, the depth is too shallow. Increase
`--depth-<app>` by 1 and re-extract.

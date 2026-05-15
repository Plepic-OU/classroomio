# C4 Model Conventions

## Levels

| Layer | Scope | PlantUML include |
|---|---|---|
| L1 — System Context | System + users + external dependencies | `C4_Context.puml` |
| L2 — Container | Deployable units (apps, DBs, services) | `C4_Container.puml` |
| L3 — Component | Named groupings of related functionality within a container | `C4_Component.puml` |
| L4 — Code | Class/function level (out of scope for this skill) | — |

## L3 Granularity Rules

- A **component** is a grouping of related modules behind a well-defined interface — NOT a single class.
- Components belong to exactly one container.
- Target granularity: roughly one "feature module" or "bounded context slice" per component.
- In this codebase, components are derived from directory depth in the source tree.

## Depth Configuration

| App | Default depth | Example component keys |
|---|---|---|
| `dashboard` | 4 | `lib/components/Course/components`, `routes/courses/[id]`, `lib/utils/functions` |
| `api` | 2 | `routes/course`, `services/course`, `utils/redis` |

**Validation**: if any single component contains > 50 files, the depth is too shallow — increase by 1.

## Svelte Handling

`ts-morph` cannot parse `.svelte` files. The extractor:
1. Parses `.ts`/`.js` files for import relationship mapping.
2. Counts `.svelte` files per component directory for metadata only.

Relationships that only exist inside `.svelte` files will be absent from the graph.

## Path Alias Resolution

The extractor reads `tsconfig.json` (including `extends` chain) to discover aliases dynamically.
Aliases are filtered to only those resolving inside the app root (excludes `$app/*`, `$env/*`).

| App | Aliases |
|---|---|
| Dashboard | `$lib → src/lib`, `$mail → src/mail` |
| API | `$src → src` |

## PlantUML C4 Quick Reference

```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml

title Component Diagram — Container Name

Container_Boundary(ctr, "Label") {
  Component(alias, "Label", "Technology", "Short description")
  ComponentDb(dbAlias, "Label", "PostgreSQL", "Short description")
}

System_Ext(extAlias, "External System", "Description")

Rel(alias, dbAlias, "Reads/writes")
Rel(alias, extAlias, "Calls", "HTTPS")

SHOW_LEGEND()
@enduml
```

## Relationship Labels

- Default: `"uses"`
- Be specific when the call type is known: `"reads/writes"`, `"calls"`, `"emits events"`

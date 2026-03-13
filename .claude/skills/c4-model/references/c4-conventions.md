# C4 Model Conventions

## Levels

- **L1 System Context**: ClassroomIO system + external actors (users, external services)
- **L2 Container**: Apps/services within the system (Dashboard, API, Supabase, Redis, Docs, Website)
- **L3 Component**: Internal structure of a container — grouped by directory (from AST)

## Mermaid C4 Syntax Reference

```
C4Context      → L1
C4Container    → L2
C4Component    → L3
```

### Key directives
- `Person(alias, "label", "desc")`
- `System(alias, "label", "desc")`
- `Container(alias, "label", "tech", "desc")`
- `Component(alias, "label", "tech", "desc")`
- `Rel(from, to, "label")`
- `UpdateLayoutConfig($c4ShapeInRow, $c4BoundaryInRow)`

## Layer 3 Granularity

Components = directory groupings from AST extraction.
- Dashboard: group by `src/<segment>/<subsegment>` (depth 2 from src/)
- API: group by `src/<segment>` (depth 1 from src/)
- If any component has >50 files → increase depth

## Output Files

| File | Contents |
|------|----------|
| `docs/c4/l1-context.md` | L1 System Context diagram |
| `docs/c4/l2-containers.md` | L2 Container diagram |
| `docs/c4/l3-dashboard.md` | L3 Dashboard components |
| `docs/c4/l3-api.md` | L3 API components |
| `docs/c4/database.md` | DB schema (token-efficient) |
| `docs/c4/components-dashboard.json` | AST extract (gitignored) |
| `docs/c4/components-api.json` | AST extract (gitignored) |

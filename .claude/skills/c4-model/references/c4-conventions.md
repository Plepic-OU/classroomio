# C4 Model Conventions for ClassroomIO

## Abstraction Levels

- **Layer 1 (System Context)**: Shows ClassroomIO as a single system plus external actors/systems (users, Supabase, email providers, S3, Redis, Cloudflare).
- **Layer 2 (Container)**: Breaks ClassroomIO into deployable containers: Dashboard (SvelteKit), API (Hono), Marketing Site, Docs, Course App, Supabase (DB + Auth + Edge Functions), Redis.
- **Layer 3 (Component)**: Breaks each container into components derived from AST analysis. A component = a group of related functionality behind a well-defined interface, mapped to directory-level groupings in the source.

## Component Identification Rules

- Components are derived deterministically from source code directory structure via ts-morph AST extraction.
- Grouping depth is configurable per app. If any component has >50 files, depth is too shallow.
- Cross-directory imports define relationships between components.
- .svelte files are counted as metadata but not parsed (ts-morph limitation).

## Mermaid C4 Syntax Reference

### Diagram Types
- `C4Context` - Layer 1
- `C4Container` - Layer 2
- `C4Component` - Layer 3

### Elements
```
Person(alias, label, descr)
Person_Ext(alias, label, descr)
System(alias, label, descr)
System_Ext(alias, label, descr)
SystemDb(alias, label, descr)
SystemDb_Ext(alias, label, descr)
Container(alias, label, techn, descr)
ContainerDb(alias, label, techn, descr)
Component(alias, label, techn, descr)
ComponentDb(alias, label, techn, descr)
```

### Boundaries
```
System_Boundary(alias, label) { ... }
Container_Boundary(alias, label) { ... }
Enterprise_Boundary(alias, label) { ... }
```

### Relationships
```
Rel(from, to, label, techn)        # auto direction
Rel_D(from, to, label)             # force downward
Rel_U(from, to, label)             # force upward
Rel_L(from, to, label)             # force leftward
Rel_R(from, to, label)             # force rightward
BiRel(from, to, label)             # bidirectional
```

### Layout Controls

#### Grid sizing
```
UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")
```

#### Relationship anchor offsets (reduce overlapping labels)
```
UpdateRelStyle(from, to, $offsetX="10", $offsetY="-20")
```

## Layout Best Practices

These techniques reduce line crossings and overlapping boxes in rendered diagrams.

### 1. Use directional relationships

Default `Rel()` lets the layout engine choose direction, which often creates crossings. Prefer explicit directions:

- **`Rel_D`** (down): for top-to-bottom flows (actors -> system -> external services)
- **`Rel_R`** (right): for peer-to-peer flows within the same tier (dashboard -> api)
- **`Rel_L`** (left): for reverse/feedback flows
- **`Rel_U`** (up): rarely needed, for bottom-to-top references

Rule of thumb: the diagram should flow **top-to-bottom** (users at top, external systems at bottom). Use `Rel_D` for that primary flow and `Rel_R`/`Rel_L` for lateral connections.

### 2. Declaration order matters

Mermaid lays out nodes roughly in declaration order, left-to-right within a row. Place tightly-connected nodes adjacent to each other in the source to minimize edge lengths and crossings.

**Within boundaries**: declare the most-connected component first.
**Across boundaries**: declare boundaries in the order of data flow (e.g., Routes before Services before Utils).

### 3. Tune grid dimensions per diagram

- **L1/L2** (few nodes): `$c4ShapeInRow="3"`, `$c4BoundaryInRow="1"`
- **L3 small** (<15 components): `$c4ShapeInRow="3"`, `$c4BoundaryInRow="2"`
- **L3 large** (15-30 components): `$c4ShapeInRow="4"`, `$c4BoundaryInRow="2"`

### 4. Split large diagrams

If a Layer 3 diagram exceeds ~25 components, split it into focused sub-diagrams by domain. Each sub-diagram should:
- Cover one concern (e.g., "UI + Routes" vs "Services + Data")
- Include relevant external system stubs for context
- Have no more than ~20 components and ~15 relationships
- Cross-reference the other sub-diagram in a comment at the top

### 5. Limit relationship density

- Only show relationships with `importCount >= 2` (or higher if still cluttered)
- If a component has >5 outbound edges, raise the threshold for that component or aggregate some targets
- Prefer showing the strongest relationships rather than all relationships

### 6. Use UpdateRelStyle for overlapping labels

When two relationship lines overlap or labels collide, offset them:
```
UpdateRelStyle(nodeA, nodeB, $offsetX="10", $offsetY="-10")
UpdateRelStyle(nodeA, nodeC, $offsetX="-10", $offsetY="10")
```

## Output Format

- All diagrams output to `docs/c4/` as `.md` files containing Mermaid code blocks.
- Diagrams are optimized for both visual readability and AI context consumption.
- Component aliases use snake_case derived from directory paths.

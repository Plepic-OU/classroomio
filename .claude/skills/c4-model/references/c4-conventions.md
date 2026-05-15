# C4 Model Conventions — ClassroomIO

## Layer summary

| Layer | Diagram type | Audience | Content |
|-------|-------------|----------|---------|
| L1 System Context | `C4Context` | Everyone | ClassroomIO + actors + external systems |
| L2 Container | `C4Container` | Tech leads | Dashboard, API, classroomio.com, Supabase |
| L3 Component | `C4Component` | Developers | Intra-container structure extracted from AST |

## Component granularity (L3)

A **component** in this repo = a directory subtree up to `depth` levels from `src/`.

| App | Default depth | Example key | Represents |
|-----|--------------|-------------|------------|
| dashboard | 4 | `lib/utils/services/org` | Org service module |
| dashboard | 4 | `lib/utils/store` | Svelte writable stores |
| dashboard | 4 | `lib/components/Course` | Course UI component group |
| dashboard | 4 | `routes/org/[slug]/settings` | Settings route handler |
| api | 2 | `routes/course` | Course HTTP handlers |
| api | 2 | `utils/redis` | Redis client + helpers |

**Too shallow (depth too low):** 40+ files in one component → single mega-component hides architecture.  
**Too deep (depth too high):** every file is its own component → diagram noise, no structure visible.  
The script warns when any component exceeds 50 files.

## Relationship extraction

Relationships are extracted deterministically from `import` statements:
- Only cross-component imports are recorded (same-component imports are noise).
- External npm package imports are ignored.
- Path aliases (`$lib`, `$src`, etc.) are resolved by reading `tsconfig.json` paths, following `extends` chains.
- `.svelte` files are counted per component for metadata but not AST-parsed (ts-morph limitation).

## Regenerating

Re-run `generate-c4.ts` whenever:
- A new service/module directory is added
- Significant import patterns change
- Depth needs adjustment

The script is deterministic — the same source tree always produces the same output.

## Intermediate JSON (gitignored)

`docs/c4/extracted-{app}.json` contains the raw component and relationship lists before diagram rendering. Useful for debugging unexpected component groupings.

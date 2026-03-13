# Chart Theme

Style rules for all generated diagrams (Mermaid).

## Colors — Dark Theme

| Element | Background | Text | Border |
|---------|-----------|------|--------|
| Diagram background | `#0f172a` | — | — |
| Primary node | `#334155` | `#ffffff` | `#475569` |
| Accent node (system) | `#2460ec` | `#ffffff` | `#475569` |
| External/tertiary node | `#64748b` | `#ffffff` | `#475569` |
| Edges/lines | — | `#94a3b8` | `#2460ec` |
| Cluster border | `#94a3b8` | `#94a3b8` | — |

## Mermaid Defaults

Every `.mmd` file must start with this init directive:

```
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#334155', 'primaryTextColor': '#ffffff', 'primaryBorderColor': '#475569', 'lineColor': '#2460ec', 'secondaryColor': '#64748b', 'tertiaryColor': '#0f172a', 'edgeLabelBackground': '#0f172a', 'clusterBkg': '#0f172a', 'clusterBorder': '#94a3b8', 'titleColor': '#ffffff', 'nodeTextColor': '#ffffff'}}}%%
```

Use these classDefs at the bottom of each chart:

```
classDef default fill:#334155,stroke:#475569,color:#ffffff
classDef accent fill:#2460ec,stroke:#475569,color:#ffffff,stroke-width:2.5px
classDef external fill:#64748b,stroke:#475569,color:#ffffff
```

- Primary nodes use default class
- The main system node uses `:::accent`
- External systems use `:::external`
- Database nodes use cylinder syntax: `[("label")]`

## Rendering

```sh
npx @mermaid-js/mermaid-cli -i <file>.mmd -o <file>.svg -b transparent
```

## Layout Rules

1. **Never draw lines over boxes.** Restructure the diagram when edges would cross nodes.
2. **Avoid long horizontal or vertical layouts.** Use subgraphs to group related nodes.
3. Balance width and height — aim for roughly square proportions.
4. Split overly connected diagrams into smaller focused views.

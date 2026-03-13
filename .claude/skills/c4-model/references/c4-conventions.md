# C4 Model Quick Reference

## Layers
| Layer | Diagram Type | Question Answered |
|-------|-------------|-------------------|
| 1 | System Context | What are we building and who uses it? |
| 2 | Container | How does the system decompose into deployable/runnable units? |
| 3 | Component | How does a container decompose into functional building blocks? |

## Granularity Rules
- **L1**: Whole system + external users/systems
- **L2**: Processes, databases, message queues, static files (separately deployable)
- **L3**: Groups of related code behind a well-defined interface — NOT individual classes or files
  - Dashboard: route groups, service namespaces, store slices, component families
  - API: route groups, service modules, utility namespaces, middleware
- **Exclude**: Utilities/domain objects that appear everywhere (too noisy)

## Relationship Labels
- Use active verbs: "reads from", "writes to", "fetches via", "subscribes to"
- Include technology when it adds clarity: "REST/JSON", "RPC", "Supabase SDK"

## Mermaid C4 Shapes
```
C4Context       → Person(), System(), System_Ext(), SystemDb()
C4Container     → Container(), ContainerDb(), Container_Boundary()
C4Component     → Component(), ComponentDb()
Relationships   → Rel(from, to, "label", "tech")
Boundaries      → System_Boundary(id, "label"){ ... }
                  Container_Boundary(id, "label"){ ... }
```

## AI-Context Principles
- Diagrams are consumed by AI assistants, not rendered for humans
- Prefer concise labels over exhaustive detail
- Every component should answer: "what is this responsible for?"
- Omit components with no meaningful cross-boundary relationships

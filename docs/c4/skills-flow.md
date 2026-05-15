# validate-design-document — Context Flow

Render the DOT source: `dot -Tsvg docs/c4/dot/skills-flow.dot -o out.svg`

The skill reads a design document, selects relevant domain-specialist validators, spawns them as parallel `general-purpose` agents (each reading the design doc, codebase files, and Context7 MCP independently), then triages findings into three buckets: auto-applied changes, conflicts requiring user decisions, and scope/architecture calls that need user input. After all decisions are applied the skill writes a validation report to `docs/plans/reports/`.

See `docs/c4/dot/skills-flow.dot` for the full diagram.

# Skills & Agents Flow

> How Claude Code orchestrates skills, subagents, and external context in this repo.
> Scope: the meta-system that produces and validates design docs — not the product itself.

## Diagram

```mermaid
flowchart TB
    User([User])

    subgraph Main["Main Claude — ONE shared context window"]
        direction TB
        Claude["Claude Code<br/>(orchestrator loop)"]

        subgraph Skills["Skills = instructions injected into main context<br/>(NOT separate processes)"]
            direction LR
            BS["brainstorming"]
            VDD["validate-design-document"]
            BDD_S["bdd-coverage"]
        end
    end

    subgraph Sub["8 validator subagents — ISOLATED contexts, parallel<br/>(spawned via Agent tool, type=general-purpose)"]
        direction LR
        V1["Supabase<br/>& DB"]
        V2["Auth &<br/>Permissions"]
        V3["SvelteKit<br/>Frontend"]
        V4["Monorepo<br/>& Build"]
        V5["Devcontainer"]
        V6["E2E Tests"]
        V7["Simplifier"]
        V8["General<br/>Quality"]
    end

    FS[("Filesystem<br/>docs/plans/*.md<br/>+ codebase")]
    MCP[("Context7 MCP<br/>library docs")]

    User -->|"/validate-design-document<br/>or natural prompt"| Claude

    Claude -.->|"Skill tool<br/>(loads instructions)"| Skills

    BS  -.->|"writes design.md"| FS
    BS  ==>|"CLOSE THE LOOP:<br/>after writing, auto-invoke"| VDD

    VDD ==>|"Agent tool ×8 in ONE message<br/>= parallel fan-out<br/>(only prompt + design path<br/>cross the boundary)"| Sub

    Sub -->|"Read tool"| FS
    Sub -->|"resolve-library-id<br/>+ get-library-docs"| MCP

    Sub ==>|"ONE return message each<br/>(CRITICAL/WARNING/NOTE findings)"| Claude

    Claude -->|"triage:<br/>Bucket A auto-apply,<br/>Bucket B conflicts,<br/>Bucket C asks"| User
    Claude -->|"Edit tool"| FS

    BDD_S -.->|"reads tests/e2e,<br/>writes features + steps"| FS

    classDef ctx fill:#1e2a3a,stroke:#4a90e2,color:#cfe2ff
    classDef sub fill:#3a2a1e,stroke:#e2a04a,color:#ffe2cf
    classDef ext fill:#2a3a1e,stroke:#90c850,color:#dfffcf
    class Main,Skills,Claude,BS,VDD,BDD_S ctx
    class Sub,V1,V2,V3,V4,V5,V6,V7,V8 sub
    class FS,MCP ext
```

## Reading the diagram

**Three context boundaries, color-coded:**

| Color | What it is | Lifetime |
|-------|------------|----------|
| Blue  | Main Claude conversation — single context window, persists across the whole session | Whole session |
| Orange | Subagent contexts — one per validator, isolated, single-shot | One Agent call |
| Green | External stores — filesystem and MCP servers | Persistent |

**Two arrow styles:**

- `-.->` dotted = lightweight (loading instructions, reading/writing files)
- `==>` bold = the critical handoffs where context shape matters (skill → skill auto-invocation, main → subagent fan-out, subagent → main return)

## What this shows

1. **Skills ≠ agents.** Skills are *instruction files* loaded into the main Claude's context — same conversation, same context window. The `Skill` tool just injects the skill's markdown.

2. **Agents = isolated.** Each of the 8 validators runs in its own context. They cannot see the main conversation. The only thing that crosses the boundary inbound is the **prompt string** passed via the `Agent` tool; the only thing that crosses outbound is **one return message**.

3. **Parallelism = one tool-call message with N `Agent` blocks.** Spawning 8 `Agent` calls inside a single assistant message makes them run simultaneously — total wall time ≈ slowest validator, not sum of all.

4. **"Close the loop"** = make `brainstorming` end by automatically invoking `validate-design-document` on the freshly written doc, so the human doesn't have to remember.

5. **Context7 is hit per-validator, not centrally.** Each subagent looks up its own library docs (Supabase, Playwright, SvelteKit…). Parallelism matters here — the doc lookups don't queue.

6. **Filesystem is the shared substrate.** Both skills and subagents read/write through it — that's how the design doc gets handed between them.

## Concrete example: the `/validate-design-document` run on 2026-05-28

1. User invokes `/validate-design-document` (no path arg).
2. Main Claude loads the skill's instructions via the `Skill` tool.
3. Main Claude picks the most recent file in `docs/plans/` (`2026-05-15-bdd-coverage-design.md`).
4. Main Claude snapshots it (`cp design.md design.before.md`) so `diff` works later.
5. Main Claude reads the 8 validator prompt files in parallel from `.claude/skills/validate-design-document/validators/`.
6. Main Claude emits **one assistant message containing 8 `Agent` tool calls** — they run in parallel.
7. Each subagent: reads design doc → reads codebase files relevant to its lens → queries Context7 for current library docs → returns one report.
8. Main Claude collects all 8 reports, triages into auto-apply / conflicts / asks-user, and presents to the user.

## Files

- Skills live at `.claude/skills/<name>/SKILL.md` (or `<name>.md`).
- Validator prompts live at `.claude/skills/validate-design-document/validators/*.md`.
- Design docs land in `docs/plans/<date>-<topic>.md`.
- This diagram lives at `docs/skills-flow.md`.

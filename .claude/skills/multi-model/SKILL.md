# Multi-Model Skill

Run different queries against different Claude models in parallel, then aggregate results.

## How to use

The user provides a list of (query, model) pairs — either explicitly or implied by context.
Spawn all agents in a **single message** so they run in parallel.

Available models: `haiku`, `sonnet`, `opus`

## Step 1 — Parse the request

Identify each (query, model) pair from the user's message. If the user says "run X with haiku
and Y with opus", treat those as two separate agents. If they say "run X with all three models",
expand to three agents with the same prompt and models haiku / sonnet / opus.

## Step 2 — Spawn agents in parallel

Use `subagent_type: "general-purpose"` for each. Set `model:` to the specified model.
Write a self-contained prompt for each agent — include all context it needs, since agents
have no memory of this conversation.

Example for three different queries:

```
Agent(haiku)  → "Summarise the failing tests in playwright-report/ in under 100 words."
Agent(sonnet) → "Review tests/e2e/features/ and identify the next coverage gap to fill."
Agent(opus)   → "Audit the BDD step definitions for selector fragility and propose fixes."
```

## Step 3 — Present results side by side

After all agents complete, present their outputs together so the user can compare directly.
Label each result clearly: **Haiku**, **Sonnet**, **Opus** (or whatever models were used).

## Step 4 — Note speed and token usage

Each agent result includes `duration_ms` and `total_tokens` in its metadata.
Report these so the user can see the cost/quality trade-off.

## Model guidance

| Model | Best for |
|-------|----------|
| `haiku` | Quick lookups, summaries, simple checks — cheapest and fastest |
| `sonnet` | Code review, gap analysis, multi-file reasoning — best value |
| `opus` | Deep cross-system analysis, subtle correctness, architecture judgment |

# Suspected bugs

Draft findings for human triage — **never** auto-filed as a GitHub issue, that's a human
call. Append one entry per suspected real app bug found while drafting a scenario: the
steps were correct, but the app didn't behave the way the flow implies it should.

A scenario left red because of an entry here should be tagged `@known-issue` and kept
(excluded from normal runs) rather than deleted, so it documents the gap instead of erasing
it.

## Entry format

```
### <short title>

- **Found:** <date>, drafting `<feature file path>`
- **Repro:** <numbered steps, or "run the tagged @known-issue scenario in <file>">
- **Expected:** <what the flow implies should happen>
- **Actual:** <what happened>
- **Evidence:** <path to a test-results/**/test-failed-*.png or trace.zip>
```

---

_No entries yet._

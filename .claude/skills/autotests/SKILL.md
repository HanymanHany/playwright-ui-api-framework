---
name: autotests
description: 'Writes new Playwright tests from approved cases: first an automation plan with a human gate, then page objects and spec files following the project conventions. Writes code only — running and debugging it is a separate stage.'
when_to_use: 'Use when the user asks to write, add, or automate tests for a feature, to implement approved test cases, or to add a page object or an API client method. Not for fixing tests that already exist and fail.'
argument-hint: '[feature]'
model: sonnet
allowed-tools: Read Write Edit Grep Glob Bash(npm run typecheck) Bash(npm run lint) Bash(npm run format:check)
---

<!-- Model: sonnet. By this point every decision has been made — the cases say what
     to test, context.md says which locators exist, conventions.md says what the code
     must look like. This step is precise transcription against a strict spec, which
     is exactly where a fast model is the right call.

     This skill absorbed the former /plan-autotests. Planning was a separate command
     that read three files and wrote a fourth, then handed straight over. The split
     cost an extra session and a full re-read of the context, and bought nothing:
     nobody ever ran the plan step without running this one next. The gate that
     mattered was the human approving the plan — and that gate is still here, in
     Phase 2, where it always was. -->

Follow `.claude/rules/conventions.md` strictly.

Phases 3-5 run through the **test-writer** agent (`.claude/agents/test-writer.md`),
started only after the Phase 2 gate is approved. The agent has no permission to run the
suite, so "writes code, never runs it" holds even if the plan is ambiguous. Phases 1 and
2 stay here: the plan is what the human approves, and approval cannot be delegated.

## Absolute prohibitions

- NEVER invent locators — only what `docs/context/<feature>/context.md` verified
- NEVER run tests — that is `/run-tests`
- NEVER import test/expect from `@playwright/test` in specs
- NEVER hand-write an API response type — `api/types.ts` derives them from the spec

## Phase 1 — Read the sources

1. `docs/test-cases/cases_<feature>.md` — cases marked `Automation: To Be Automated`
2. `docs/context/<feature>/context.md` — verified locators and API fields
3. Existing `pages/`, `api/`, `fixtures/` — grep for method and getter names that
   already exist, so nothing is duplicated

### Freshness check on the context (before planning anything)

Every section of `context.md` carries the date it was verified:

```bash
grep -nE 'Last updated|verified [0-9]{4}-[0-9]{2}-[0-9]{2}' docs/context/<feature>/context.md
```

A locator map older than **30 days** is a claim, not a fact. Do not refuse to work and
do not silently trust it: list every stale section under `## Risks` in the plan, and say
which tests depend on it. The human at the Phase 2 gate then decides whether to explore
first or accept the risk. Stale locators fail as timeouts three stages later, where the
cause is least visible.

## Phase 2 — Write the plan, then STOP

Write `docs/plans/plan-<feature>-<date>.md`:

```
# Plan: <feature>
Status: ready

## Spec files
tests/<feature>/<name>.<api|ui|hybrid>.spec.ts — N tests: [case titles]

## Data plan
- snapshot picks: [pickInStockProducts(n) / pickLeafCategory / ...]
- distinct slices: [which test gets which entity — fullyParallel is ON]
- live API state: [what beforeAll creates, which client]
- namespacing: [what carries RUN_ID]
- cleanup: [what afterAll removes, as whom]

## Page object additions
pages/<x>.page.ts — [new getters/methods, with data-test values from context.md]

## API client additions
api/<x>.api.ts — [new methods + endpoints; are they in the OpenAPI spec?]

## Fixtures
[new fixtures needed in base.fixture.ts]

## Risks / open questions
[anything unverified — locators not in context.md, unclear behaviours]
```

Show the summary. If `## Risks` is non-empty, say what needs `/explore` first.

**CHECKPOINT — wait for approval before writing any code.**

## Phase 3 — Page objects

Add ONLY missing getters and methods. Locators exclusively from context.md.
When a needed locator is not there:

```typescript
// MISSING: [data-test="x"] — not verified in context.md; test will fail until /explore confirms it
```

Write the test anyway — `/run-tests` will catch it. Report it at the end.
Never invent a selector, never `test.skip` to hide the gap.

## Phase 4 — Spec files

- `beforeAll`: snapshot reads; distinct entity slices per test
- `afterAll`: API cleanup, tolerant to 404, as the entity's owner
- Test body: Prepare/Action/Verify steps, tags, `[Section / SubSection]` describe
- All strings via `data/`, all tokens via `getToken()` at the point of use
- Assertions target the entity this test created, by id — never global counts

## Phase 5 — Static gates + handoff

```bash
npm run typecheck && npm run lint && npm run format:check
```

Fix everything. Then report: "Done: [files]. Next step: /run-tests <spec>."

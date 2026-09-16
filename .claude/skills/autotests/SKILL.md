---
name: autotests
description: 'Implements approved test cases for one task: writes an automation plan with a human gate, then page objects and spec files through the test-writer agent, then takes the new tests to green under the project rules for running and fixing.'
when_to_use: 'Use when the user gives a task key to automate, or asks to write, add or automate tests for a feature, implement approved test cases, add a page object or an API client method, or to fix the tests that were just written.'
argument-hint: '[task-key]'
model: sonnet
allowed-tools: Read Write Edit Grep Glob Bash(npx playwright test:*) Bash(npm run typecheck) Bash(npm run lint) Bash(npm run format:check)
---

<!-- Model: sonnet. By this point every decision has been made — the cases say what to
     test, context.md says which locators exist, conventions.md says what the code must
     look like, running-tests.md says how to take it green. This step is precise
     transcription against a strict spec, which is exactly where a fast model is right.

     This skill absorbed three former commands. /plan-autotests was split off as its own
     stage and bought nothing: nobody ever ran the plan without running this next, and
     the gate that mattered — the human approving the plan — is still here in Phase 2.
     /run-tests and /flake-hunt were procedures with no decision in them, so they became
     .claude/rules/running-tests.md, which this skill reads in Phase 6 and which anyone
     else can read without pressing a button. -->

Follow `.claude/rules/conventions.md` strictly.

Phases 3-5 run through the **test-writer** agent (`.claude/agents/test-writer.md`),
started only after the Phase 2 gate is approved. The agent has no permission to run the
suite, so "the writer writes, it does not run" holds even if the plan is ambiguous.
Phases 1 and 2 stay here: the plan is what the human approves, and approval cannot be
delegated. Phase 6 stays here too, because fixing a test means deciding whether the test
or the product is wrong.

## The key

The argument is the same **key** used by `/checklist` and `/cases` — a tracker id
(`PROJ-431`) or a feature name (`checkout`). Everything resolves from it:

```bash
docs/test-cases/cases_<key>.md        # what to build; its header names the feature
docs/checklists/checklist_<key>.md    # what was agreed to be in scope
docs/context/<feature>/context.md     # the only source of locators and API field names
```

Missing inputs are handled per `.claude/rules/pipeline.md`, and none of them is worked
around silently:

- **no key given** — list `docs/test-cases/` and ask which one, rather than picking
- **no cases file for this key** — stop and offer `/cases <key>`. Implementing from a
  checklist skips the stage where scenarios got their layer, their data plan and their
  cleanup owner
- **no context map for the feature** — stop and offer `/checklist <key>`. Locators are
  never invented, and that rule has no exception for a hurry
- **a plan already exists for this key** — read it. `Status: ready` with unchanged sources
  means continue from Phase 3; do not silently re-plan what was already approved

## Absolute prohibitions

- NEVER invent locators — only what `docs/context/<feature>/context.md` verified
- NEVER import test/expect from `@playwright/test` in specs
- NEVER hand-write an API response type — `api/types.ts` derives them from the spec
- NEVER skip a failing test or raise `retries` to reach green (see Phase 6)

## Phase 1 — Read the sources

1. `docs/test-cases/cases_<key>.md` — cases marked `Automation: To Be Automated`
2. `docs/context/<feature>/context.md` — verified locators and API fields
3. Existing `pages/`, `api/`, `fixtures/` — grep for method and getter names that already
   exist, so nothing is duplicated

### Freshness check on the context (before planning anything)

Every section of `context.md` carries the date it was verified:

```bash
grep -nE 'Last updated|verified [0-9]{4}-[0-9]{2}-[0-9]{2}' docs/context/<feature>/context.md
```

A locator map older than **30 days** is a claim, not a fact. Do not refuse to work and do
not silently trust it: list every stale section under `## Risks` in the plan, and say
which tests depend on it. The human at the Phase 2 gate then decides whether to run
`/checklist` again first or accept the risk. Stale locators fail as timeouts two phases
later, where the cause is least visible.

## Phase 2 — Write the plan, then STOP

Write `docs/plans/plan-<key>.md`:

```
# Plan: <key>
Key:     <key>
Feature: <feature>
Status:  ready

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
[anything unverified — locators not in context.md, stale sections, unclear behaviours]
```

Show the summary. If `## Risks` is non-empty, say what needs `/checklist <key>` first.

**CHECKPOINT — wait for approval before writing any code.**

This is the most expensive gate to skip: the data plan decides whether the file is
parallel-safe and the cleanup owner decides whether teardown can succeed at all, and both
are painful to change once the tests exist.

## Phase 3 — Page objects

Add ONLY missing getters and methods. Locators exclusively from context.md.
When a needed locator is not there:

```typescript
// MISSING: [data-test="x"] — not verified in context.md; test will fail until /checklist confirms it
```

Write the test anyway — Phase 6 will catch it. Report it at the end. Never invent a
selector, never `test.skip` to hide the gap.

## Phase 4 — Spec files

- `beforeAll`: snapshot reads; distinct entity slices per test
- `afterAll`: API cleanup, tolerant to 404, as the entity's owner
- Test body: Prepare/Action/Verify steps, tags, `[Section / SubSection]` describe
- All strings via `data/`, all tokens via `getToken()` at the point of use
- Assertions target the entity this test created, by id — never global counts

## Phase 5 — Static gates

```bash
npm run typecheck && npm run lint && npm run format:check
```

Fix everything before running anything. A run started with a type error tells you about
the type error, slowly.

## Phase 6 — Take the new tests to green

Follow `.claude/rules/running-tests.md` exactly: one test at a time at `--workers=1`, the
failure table, at most two focused fix attempts per test, then confirm the file twice at
the configured worker count because passing at one worker proves the logic and nothing
about isolation. If the same spec disagrees with itself between runs, run the isolation
check in the same file rather than guessing.

The rules that are not negotiable while doing this: no skipping a failing test, no raised
`retries`, and no assertion quietly weakened to match what the app happens to do. If the
product is wrong, red is the correct outcome and it goes in the report as a product
finding.

## Phase 7 — Report and hand off

```
Files:     [created / changed]
Tests:     [N written → M green]
✗ stuck:   [test → root-cause hypothesis → what was tried → what is needed]
⚠ product: [anything that looks like a defect rather than a test problem]
MISSING:   [locators that were not in context.md]
Next step: /test-code-review
```

---
name: cases
description: 'Turns an approved QA checklist into detailed test cases: picks the right layer (api / ui / hybrid) for each scenario, writes machine-verifiable expected results, and adds the Automation notes the implementation stage builds from.'
when_to_use: 'Use when the user asks to write test cases, design test scenarios, turn a checklist into cases, decide whether a scenario belongs in an API or a UI test, or asks which scenarios are worth automating.'
argument-hint: '[task-key]'
model: opus
allowed-tools: Read Write Edit Grep Glob
---

<!-- Model: opus. Test design is the judgment step of the whole pipeline: which
     scenarios matter, what the real edge cases are, what is genuinely not worth
     automating. A weaker model produces plausible cases that cover the happy path
     and miss the risk — and everything downstream is built on this output. -->

## Step 1 — Resolve the key, pick scope

The argument is the same **key** `/checklist` was run with — a tracker id (`PROJ-431`) or
a feature name (`checkout`). Everything is found from it:

```bash
ls docs/checklists/checklist_<key>.md      # the task checklist
head -10 docs/checklists/checklist_<key>.md # its header names the feature and context file
```

No key given: list `docs/checklists/` with per-file coverage counts (items vs
`[TC]`-marked) and ask which one — the specialist should be choosing from what exists, not
recalling it. No checklist for this key: stop, say so, and offer `/checklist <key>`.
Inventing scenarios here skips the only gate where the specialist chose what matters.
Full contract: `.claude/rules/pipeline.md`.

Then ask which items are in scope: priorities (H/M/L/all), or an explicit list. Not
everything on a checklist becomes a case, and that decision belongs to the specialist.

## Step 2 — Read sources in order

1. `docs/context/<feature>/context.md` (the path is in the checklist header) — exact
   locators, API fields, validation rules, pitfalls. PRIMARY source for Automation notes
2. Functional Context block of the checklist
3. The checklist items themselves (skip `[x] ... [TC]` lines)

Browser (per rules/browser) only as a fallback for a missing concrete detail —
announce it first.

## Step 3 — Choose the layer for each case

Before writing anything, decide where each scenario belongs. Getting this wrong is
more expensive than writing the case badly, because it produces slow, redundant
coverage that nobody dares delete.

| The case is about                                | Layer            |
| ------------------------------------------------ | ---------------- |
| A rule the server enforces (validation, status)  | `api`            |
| The shape of a response matching the spec        | `api` — contract |
| What the user sees or can do                     | `ui`             |
| Whether a UI action really reached the backend   | `hybrid`         |
| Rendering of state that is tedious to click into | `hybrid`         |

Rule of thumb: if the setup takes more clicks than the assertion, it is a hybrid case.
If the same rule is already asserted at the API layer, the UI case checks only that
the user is _told_ — not the rule itself.

## Step 4 — Write cases (review gate)

Template per case:

```
## [Section / SubSection] Title (verb + what + condition)

Priority:   High / Medium / Low
Layer:      api / ui / hybrid
Automation: To Be Automated / Manual
Tags:       Smoke, Regression, Negative, Security

Preconditions:
* [exact data state: "signed in as the run user", "an in-stock product from the snapshot"]

Steps:
1. Action: [one atomic action — name the exact UI element]
   Expected: —
2. Action: ...
   Expected:
   * [programmatically verifiable result]

Automation notes:
* Data: [productsFor(snapshot, '<consumer>') / pickLeafCategory / buildApiUser('<prefix>')]
* Locators: [data-test values from context.md]
* API call: [endpoint, and whether it is in the OpenAPI spec]
* Isolation: [what must be unique per test — fullyParallel is ON]
* Cleanup: [what afterAll removes, and as whom]
```

Rules:

- Expected results must be machine-verifiable ("an error naming the password field
  appears", not "works correctly")
- Preconditions name exact data state; data always resolves via API or snapshot,
  never a hardcoded product name or id
- Anything the case creates must be namespaced with `RUN_ID` and cleaned up
- Two cases must never need the same entity — say which slice each one takes
- `Automation: Manual` only for genuinely non-automatable scenarios
- Title prefix `[Section / SubSection]` becomes the `test.describe` name, which
  `core/allure-labels.ts` parses into the report's feature and story

Show all cases and wait for edits or approval. Revisions via a confirmed change plan;
never silently change unmentioned cases; never drop Notes sections during edits.

## Step 5 — Save + postcondition

1. Save to `docs/test-cases/cases_<key>.md` (append if it exists), carrying the same
   header as the checklist — `Key`, `Feature`, `Context` — so `/autotests <key>` resolves
   all three files from one argument
2. Mark covered checklist lines: `- [x] ... [TC]`
3. Report: written N cases (H/M/L, per layer), remaining uncovered, and
   "Next step: /autotests `<key>`"

### If the team keeps cases in a TMS

This repository writes Markdown because a public template cannot assume Qase, TestRail or
Zephyr. On a real project this is where approved cases are pushed to the TMS through its
API, and where the same API marks them `automated` once the implementation stage is done.
It is a thin skill of its own — the decision of what to write was already made and
approved above; pushing it is mechanical. Manual re-typing has no advantage over it
except habit.

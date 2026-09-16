---
name: checklist
description: 'Turns a task (a tracker key, or a feature described in the request) into a reviewed QA checklist: reads whatever the ticket says, then verifies it against the running application through the explorer agent, and writes the task checklist plus the feature context map that every later stage reads.'
when_to_use: 'Use when the user gives a task key or asks to explore a feature, map a page, build a QA checklist, collect or verify locators, or check which data-test attributes a page exposes. Also use when a later stage reports a locator missing from context.md.'
argument-hint: '[task-key or feature]'
model: sonnet
allowed-tools: Read Write Edit Grep Glob mcp__playwright Bash(npx tsx tmp/*) Bash(curl:*)
---

<!-- Model: sonnet. This is disciplined observation, not judgment — walk the pages,
     record what is there, write it down. The rules do the thinking; the volume of DOM
     output is high. Paying Opus rates to transcribe attributes is waste.

     This skill was called /explore and took a feature name. It takes a key now because
     the key is what the rest of the pipeline resolves everything by: /cases and
     /autotests find these artifacts without being told where they are. -->

The first stage of the pipeline. It produces the file every later stage depends on: if
`context.md` is wrong, `/autotests` writes locators that do not exist and the run stage
spends its budget discovering that. Accuracy here is worth more than speed.

Browser operation rules: follow `.claude/rules/browser.md` for everything browser-related.
Key, artifact names and missing-input behaviour: `.claude/rules/pipeline.md`.

## Step 0 — The key

The argument is a **key** — a tracker id (`PROJ-431`) or a feature name (`checkout`).
Whatever it is, the same string is passed to `/cases` and `/autotests`, which is how they
find these artifacts without being told where they are.

Run without one, follow `.claude/rules/pipeline.md`: derive the key from the feature the
request names, reusing an existing `docs/context/<feature>/` name where there is one, and
state it in a line before starting. If the request names nothing usable, ask once — with
the tracker option and the list of features that already have a context map, not an open
question. Never invent a scope silently.

Two artifacts come out of this stage and they have different lifetimes:

| Artifact                             | Belongs to  | Lives                              |
| ------------------------------------ | ----------- | ---------------------------------- |
| `docs/checklists/checklist_<key>.md` | the task    | until the task is closed           |
| `docs/context/<feature>/context.md`  | the feature | for years — merged, never replaced |

Keep them apart. Put the locator map in the task file and in a year there are ten copies
of it keyed by ticket number, half of them lying, with no way to tell which half.

## Step 1 — Get the input (one message)

If a tracker MCP server is configured (Jira, Linear, whatever your team uses), read the
ticket by its key: description, acceptance criteria, and the comments — half the
behaviour is usually explained there and never makes it into the description.

If there is no tracker integration, or the ticket is thin, ask for everything at once:

> "Tell me in one message:
>
> - Which pages/routes does this cover?
> - What should I verify specifically?
> - Logged-in or guest scenario?"

**Acceptance criteria are input, not truth.** They describe what was intended; the
application is what exists. Every disagreement between the two is a finding, and finding
them here costs nothing compared to finding them in a failing test three stages later.

## Step 2 — Read existing context BEFORE opening a browser

Check `docs/context/<feature>/context.md`. Skip anything already recorded under
`## UI Behavior Map` / `## data-test Attributes Map`, and note the gaps to fill. Sections
carry the date they were verified — anything older than 30 days is re-checked, not
trusted.

## Step 3 — The API side, from the spec first

The OpenAPI document is downloaded to `.auth/openapi.json` by global-setup, or available
at `OPENAPI_URL`. Read it before probing anything by hand:

- exact path templates (`/products/{productId}`, not `/products/{id}`)
- request and response schemas, and which fields are actually `required`
- **`description` fields on properties** — this is where validation rules hide. The
  password breach check and the 18–75 age window were both documented there and nowhere
  else.

Then confirm live with curl: status codes, and whether the server really sends what the
spec promises. The spec is a claim; the response is the fact. Record both, and record the
disagreement if there is one — that is a finding, not noise.

## Step 4 — Walk the application (through the explorer agent)

Run this step through the **explorer** agent (`.claude/agents/explorer.md`) — pass it the
approved scope and let it return the draft checklist.

This is not a preference. A DOM dump of a full page is thousands of tokens of raw
attributes, and keeping that out of the main session is what leaves room for the review
gate in Step 5. The agent also cannot touch `tests/`, `pages/` or `api/`, which is what
makes "exploration writes docs, never code" an enforced boundary rather than an
instruction.

The agent drives a real browser through Playwright MCP against `UI_BASE_URL`
(`config/env.ts` — point it at your local stand or test environment via `.env`). For each
page in scope: behaviours and locators simultaneously, every interactive element. Two
things to check deliberately, because both have already bitten here:

- **Is the form stricter than the API?** Submit with only the API-required fields. If
  nothing hits the network, the UI has its own required field — record which.
- **Do `<select>` options have stable values?** If the visible label differs from the
  value, or the app has a language switcher, the value is the only safe target.

## Step 5 — Checklist + review gate

Generate the two-section document:

**Section A — Functional Context**: what the section does, user scenarios, UI elements and
behaviour, entry points, test data, "not verifiable via Playwright".

**Section B — Checklist**: `- [ ] [H/M/L] Scenario @Tag → layer` — business scenarios, not
element checks. "The email field gets a red border" is not a scenario; "a user with a
declined card is stopped and told why" is. High first. Tags: Smoke, Regression, Negative,
Security, API, UI, Hybrid.

For each item note which layer should own it. A rule the API enforces belongs in an API
test; the UI test's job is only whether the user is told about it. Deciding this now
prevents the same rule being asserted three times in three places.

Show it: "Here is the checklist for `<key>`. Waiting for edits or approval."
Apply revisions through a confirmed change plan — change ONLY what was agreed.

## Step 6 — Save artifacts

1. `docs/checklists/checklist_<key>.md` — the approved checklist, with this header so the
   rest of the pipeline can resolve the rest:

   ```
   Key:     PROJ-431            # or the feature name, if that is the key
   Feature: checkout            # which docs/context/<feature>/ this task touches
   Context: docs/context/checkout/context.md
   Source:  ticket / described in session / both
   Date:    2026-09-15
   ```

2. `docs/context/<feature>/context.md` — the English knowledge base. **MERGE, never
   overwrite verified sections**: Routes / data-test Attributes Map / UI Behavior Map /
   Forms / API field mapping / Validation rules / Test Data Patterns / Known Pitfalls.

Date every section. A locator map with no date is a map nobody trusts. Only verified
facts go in — what the agent saw in the live application, never a guess and never a
restatement of the ticket. A map that accepts guesses turns to landfill in one sprint,
and there is no way to separate them out afterwards.

If a context file is getting unwieldy, split it the way you would split code — by page or
sub-feature (`docs/context/checkout/payment.md`, `.../address.md`) with a short index at
the top of `context.md` saying what lives where.

## Step 7 — Cleanup and handoff

Delete `tmp/` scripts created during the session and remove any test data created while
exploring. Report: file paths, checklist counts (H/M/L), anything in the ticket that the
application disagreed with, and "Next step: /cases `<key>`".

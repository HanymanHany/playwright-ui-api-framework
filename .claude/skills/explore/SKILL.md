---
name: explore
description: 'Maps one feature of the app in a single browser session: records UI behaviours, verifies every locator against the live DOM, probes the matching API endpoints, and writes docs/context/<feature>/context.md plus a prioritised QA checklist. The only source of verified locators for the whole pipeline.'
model: sonnet
when_to_use: 'Use when the user asks to explore a feature, map a page, collect or verify locators, check which data-test attributes a page exposes, or build a QA checklist for a section. Also use when a later stage reports a locator missing from context.md.'
argument-hint: '[feature-or-routes]'
allowed-tools: Read Write Edit Grep Glob Bash(npx tsx tmp/*) Bash(curl:*)
---

<!-- Model: sonnet. This is disciplined observation, not judgment — walk the pages,
     record what is there, write it down. The rules do the thinking; the volume of
     DOM output is high. Paying Opus rates to transcribe attributes is waste. -->

Browser operation rules: follow `.claude/rules/browser.md` for everything browser-related.

Run Step 4 through the **explorer** agent (`.claude/agents/explorer.md`) — pass it the
approved scope and let it return the draft checklist. This is not a preference: a DOM
dump of a full page is thousands of tokens of raw attributes, and keeping that out of
the main session is what leaves room for the review gate in Step 5. The agent cannot
touch `tests/`, `pages/` or `api/`, which is what makes "exploration writes docs, never
code" an enforced boundary rather than an instruction.

Steps 1, 5 and 6 stay in the main session — they need the human.

This skill produces the file every later stage depends on. If `context.md` is wrong,
`/autotests` writes locators that do not exist and `/run-tests` spends its budget
discovering that. Accuracy here is worth more than speed.

## Step 1 — Scope (one message)

If the specialist's message doesn't already say, ask everything at once:

> "Tell me everything in one message:
>
> - Which pages/routes to explore?
> - Anything to verify specifically?
> - Logged-in or guest scenario?"

## Step 2 — Read existing context BEFORE opening a browser

Check `docs/context/<feature>/context.md`. Skip anything already recorded under
`## UI Behavior Map` / `## data-test Attributes Map`. Note the gaps to fill.

## Step 3 — The API side, from the spec first

The OpenAPI document is downloaded to `.auth/openapi.json` by global-setup, or
available at `OPENAPI_URL`. Read it before probing anything by hand:

- exact path templates (`/products/{productId}`, not `/products/{id}`)
- request and response schemas, and which fields are actually `required`
- **`description` fields on properties** — this is where validation rules hide.
  The password breach check and the 18–75 age window were both documented there
  and nowhere else.

Then confirm live with curl/fetch: status codes, and whether the server really sends
what the spec promises. The spec is a claim; the response is the fact. Record both,
and record the disagreement if there is one — that is a finding, not noise.

## Step 4 — Browser session (per rules/browser)

For each page in scope: behaviours and locators simultaneously, every interactive
element. Two things to check deliberately, because both have already bitten here:

- **Is the form stricter than the API?** Submit with only the API-required fields.
  If nothing hits the network, the UI has its own required field — record which.
- **Do `<select>` options have stable values?** If the visible label differs from
  the value, or the app has a language switcher, the value is the only safe target.

## Step 5 — Checklist + review gate

Generate the two-section document:

**Section A — Functional Context**: what the section does, user scenarios, UI elements
and behaviour, entry points, test data, "not verifiable via Playwright".

**Section B — Checklist**: `- [ ] [H/M/L] Scenario @Tag` — business scenarios, not
element checks. High first. Tags: Smoke, Regression, Negative, Security, API, UI, Hybrid.

For each item, note which layer should own it. A rule that the API enforces belongs in
an API test; the UI test's job is only whether the user is told about it. Deciding this
now prevents the same rule being asserted three times in three places.

Show to the specialist: "Here is the checklist for [feature]. Waiting for edits or approval."
Apply revisions through a confirmed change plan (change ONLY what was agreed).

## Step 6 — Save artifacts

1. `docs/checklists/checklist_<feature>.md` — approved checklist as-is
2. `docs/context/<feature>/context.md` — English knowledge base (MERGE, never
   overwrite verified sections): Routes / data-test Attributes Map / UI Behavior Map /
   Forms / API field mapping / Validation rules / Test Data Patterns / Known Pitfalls

Date every section. A locator map with no date is a map nobody trusts.

## Step 7 — Cleanup

Delete `tmp/` scripts created during the session, and remove any test data created
while exploring. Report file paths + checklist counts (H/M/L).

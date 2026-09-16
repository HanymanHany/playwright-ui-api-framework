# Playwright UI + API Test Automation Framework

[![tests](https://github.com/HanymanHany/playwright-ui-api-framework/actions/workflows/tests.yml/badge.svg)](https://github.com/HanymanHany/playwright-ui-api-framework/actions/workflows/tests.yml)
[![Playwright](https://img.shields.io/badge/Playwright-1.58-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A working test framework — UI, API, and **hybrid** — built against a real
application: the [Toolshop demo store](https://practicesoftwaretesting.com).

Clone it, run `npm test`, and 37 tests execute against a live site in roughly half a
minute — 34 green and three that fail
[on purpose](#the-three-tests-that-fail-on-purpose), because a report nobody ever sees
red teaches nothing. Nothing to configure, no account to create. (The suite talks to a
public demo over the internet, so the wall-clock number moves with the network: 25-35
seconds at four workers, about twice that at one.)

It is meant to be **a starting point, not a finished product**. Joining a team that
already has a framework is a very different experience from starting from an empty
folder, and this is the empty folder problem solved once. What is missing, and why,
is listed honestly under [What this framework is not](#what-this-framework-is-not).

---

## When a test fails

A red test here hands over what it did, not only what it expected:

- **`api-traffic`** — every API call the test made: anything not 2xx first with both
  bodies, then the full sequence, and a `curl` per entry that replays it. Secrets are
  redacted before they are ever stored, so the attachment is safe to keep in CI
  artifacts.
- **`browser-console`** — JS errors and warnings from the page, attached only on
  failure. A locator that "timed out" is regularly a component that threw during render.
- The usual Playwright trace and screenshot.

Nothing is attached when a test passes — this is diagnostics, not logging.

## Why it looks the way it does

Most of the decisions here exist because of a specific failure they prevent.
Those are the interesting parts:

| Decision                                                               | The failure it prevents                                                                                                                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Every run registers its own user** (`core/run-user.ts`)              | The shared demo account is used by the docs, the reseed job, and all four of our own workers. Sharing it produces a flake that reproduces once every twenty runs.                |
| **`fullyParallel: true`, `retries: 0`**                                | Parallelism is turned on _after_ isolation, not before. Zero retries because a retry converts a real race into a green build and defers the diagnosis to the worst possible day. |
| **Types generated from OpenAPI** (`npm run api:types`)                 | Hand-written response interfaces drift from the backend silently. Regenerate, run `typecheck`, and every broken line is named.                                                   |
| **Typed HTTP client** (`api/client.ts`)                                | Paths and query params as strings let `/products/{id}` and an undocumented `by_category_slug` through. Typed against the schema, both are compile errors.                        |
| **Contract tests** (`tests/contract/contract.api.spec.ts`)             | A generated type only proves what the _spec_ says. These validate live responses against that spec — the first run caught a path template mismatch.                              |
| **TTL-aware token provider** (`api/auth.api.ts`)                       | This API issues **300-second** JWTs. A token fetched in global-setup is dead before a medium suite finishes.                                                                     |
| **UI asserted against API truth** (`tests/catalog/catalog.ui.spec.ts`) | "Assert these three product names appear" passes while the filter returns the wrong subset. Ask the API what _should_ be there instead.                                          |
| **Hybrid tests** (`*.hybrid.spec.ts`)                                  | Setting up state by clicking makes a favorites test fail because the catalog changed. State via API (~200ms), browser only for the actual claim.                                 |
| **Allure labels derived from tags** (`core/allure-labels.ts`)          | Per-test `severity()` calls go stale within a month. Compute them from what the test already declares.                                                                           |

Full rationale, decision by decision, in
[.claude/rules/architecture.md](.claude/rules/architecture.md).

## Quick start

```bash
npm install
npx playwright install chromium
npm test                  # registers a run user, runs everything, cleans up
npm run report:allure     # Allure report with severity, layers and features
```

No `.env` needed — defaults target the public demo. See `.env.example`.

## Layout

```
config/env.ts             the only place that reads process.env
core/
  run-user.ts             the account this run owns — the basis of isolation
  global-setup.ts         register user → UI login → data snapshot → OpenAPI spec
  global-teardown.ts      remove favorites, then the user (admin role required)
api/
  generated/schema.d.ts   GENERATED from the live OpenAPI — never edited by hand
  types.ts                domain types derived from it, and why they are narrowed
  contract.ts             runtime validation of responses against that spec
  client.ts               openapi-fetch — paths and params checked by the compiler
  *.api.ts                typed clients over api/client.ts
pages/
  components/             elements present on every page (the header)
  auth|account|shop/      Page Objects: private getter locators, goto + assertPageLoaded
fixtures/base.fixture.ts  all dependency injection; `test`/`expect` come from here
data/                     routes + UI labels, so no test hardcodes a string
utils/                    logger, data snapshot
tests/<feature>/          grouped by feature; layer is the suffix (.api/.ui/.hybrid)
docs/                     context maps, checklists, test cases, plans — the pipeline's output
.claude/                  the AI pipeline: rules, skills, agents, hooks
```

Specs are grouped by **feature**, not by layer — `tests/auth/` holds
`auth.api.spec.ts`, `login.ui.spec.ts` and `registration.api.spec.ts` together. The
Playwright projects match the filename suffix instead of the folder, so the `api`
project still launches no browser while everything about one feature stays in one
place. Grouping by layer looks tidy at thirty tests and turns `tests/ui/` into a
sixty-file drawer at three hundred.

## Commands

| Command                                       | What it does                                                   |
| --------------------------------------------- | -------------------------------------------------------------- |
| `npm test`                                    | Full suite, 4 workers — 34 pass, 3 fail on purpose (see below) |
| `npm run test:green`                          | Everything except the deliberate failures                      |
| `npm run test:demo`                           | Only the three deliberate failures                             |
| `npm run test:smoke`                          | `@smoke` subset                                                |
| `npm run test:api`                            | API project only — no browser is launched                      |
| `npm run test:headed`                         | Visible browser                                                |
| `npm run api:types`                           | Regenerate types from the live OpenAPI spec                    |
| `npm run typecheck` / `lint` / `format:check` | Quality gates                                                  |
| `npm run report:allure`                       | Allure report                                                  |

Tags: `@smoke`, `@regression`, `@negative`, `@security`, `@contract`,
`@api`, `@ui`, `@hybrid`, `@demo`.

### The three tests that fail on purpose

`tests/demo/demo-failure.api.spec.ts` and `tests/demo/demo-failure.ui.spec.ts` are tagged
`@demo` and **fail by design**. They are not leftovers and they are not broken — they
are documentation.

Every report screenshot in every README is green, which is the least useful state a
report has. Nobody shows what happens when a test goes red, which is the state you will
actually spend your time in. So the suite ships one of each:

- **UI** — fails on the last step, after three that pass. The report then shows the
  login worked, the navigation worked, and only the final claim was wrong. Attached:
  the screenshot of the page as it really was, the trace, the captured browser console,
  and Playwright's `error-context.md`
- **API** — no browser, nothing to screenshot. What you get instead is the assertion
  reading `Expected: 600 / Received: 300`, with the message from
  `expect(value, 'why this matters')` as the first line

Run `npm test` and the suite is red on purpose: 34 passed, 3 failed. `npm run test:green`
skips them; `npm run test:demo` runs only them. **CI excludes them** — there a red run
means "this suite is broken", and a status badge has no way to say "on purpose".

## How it was built

That distinction is the whole point of this repository, and it is worth being direct
about it rather than leaving it to be guessed. A model typed nearly every line. What
it did not do was choose to register a user per run instead of adding retries, refuse
a token-pool pattern that a 300-second JWT makes unsafe, group specs by feature rather
than by layer, or decide that a second hand-written schema was worse than none. Every
one of those is written down with its reasoning in
[.claude/rules/architecture.md](.claude/rules/architecture.md), which is the part of
this repository actually worth reading.

The same applies in reverse: reviewing the AI pipeline itself turned up six defects in
instructions I had written, none of which produced an error message. That story is in
the article this repository accompanies.

Every feature went through the same pipeline, and each stage has a gate where a
human approves before the next one starts:

```
/setup → /checklist <key> → /cases <key> → /autotests <key> → /test-code-review → /commit-push
```

`<key>` is a tracker id (`PROJ-431`) or a feature name (`checkout`), and it is the only
thing passed between stages — each one resolves its own inputs from it. If a tracker MCP
server is configured, `/checklist` reads the ticket itself; if not, the feature is
described in the request. Either way the acceptance criteria are treated as input rather
than truth: the `explorer` agent opens the running application and records what is
actually there, and the disagreements are the first findings of the task.

- **rules** (`.claude/rules/`) — the standards: conventions, architecture decisions, how
  to operate a browser, how tests are run and fixed, and how the stages hand work to each
  other (including what a stage does when run without a key, or before the stage it
  depends on — it stops and names the command that produces what is missing)
- **skills** (`.claude/skills/`) — the procedures, one per stage above. A stage exists as
  a command only where a human decides something; everything else is a rule
- **agents** (`.claude/agents/`) — narrow executors with restricted permissions:
  `explorer` drives the browser through Playwright MCP and never touches test code;
  `test-writer` writes code and never runs it; `reviewer` reviews and never commits
- **hooks** (`.claude/hooks/`) — the two rules that are enforced rather than asked for:
  generated files, `.env` and `.auth/` cannot be edited, and `--force`, `--no-verify` and
  `--amend` are refused. A rule that can be forgotten is a suggestion; these cannot be
  forgotten

Two things that used to be commands are rules now, because neither contained a decision.
Running and fixing tests (one at a time, at most two fix attempts, never a raised retry)
lives in [.claude/rules/running-tests.md](.claude/rules/running-tests.md), together with
the isolation check that keeps `retries: 0` and `fullyParallel: true` honest — five runs
at four workers, and a table that tells a shared entity from a hoisted token from state
that outlived teardown. A retry is never the answer it proposes.

Artifacts have two lifetimes and are stored accordingly: `docs/context/<feature>/context.md`
belongs to the feature and is merged for years, while the checklist, the cases and the plan
belong to one task and are keyed by it. Mixing them produces ten copies of the same locator
map a year later, half of them wrong, with no way to tell which half.

The last two stages are chained rather than merged: the review records a fingerprint of
what it approved, and `/commit-push` refuses a diff that has changed since. Two stages,
two models, two human approvals — a step that starts out intending to commit is worse
at finding reasons not to.

The hard rule that matters most: **locators are never invented**. They come only
from `docs/context/<feature>/context.md`, which is written by exploring the live DOM.
A missing locator is reported, not guessed.

### Models

Different stages need different amounts of judgment, and paying top-tier rates for
mechanical work is just waste. Each skill and agent pins its own model:

| Stage                                        | Model  | Why                                                       |
| -------------------------------------------- | ------ | --------------------------------------------------------- |
| `/cases`, `/test-code-review`, `reviewer`    | Opus   | Test design and finding subtle violations — judgment work |
| `/setup`, `/checklist`, `/autotests`, agents | Sonnet | Following a spec precisely; the rules do the thinking     |
| `/commit-push`                               | Haiku  | Mechanical: stage, message, confirm                       |

## What this framework is not

Being specific about the gaps is more useful than pretending there are none:

- **No integration with your TMS, Jira, or reporting stack.** Those are per-company and
  would be dead weight here. The pipeline is shaped for them — stages take a task key, and
  `/checklist` reads a ticket through a tracker MCP server when one is configured — but
  wiring Qase, TestRail or Jira is yours to add.
- **No SSO, MFA, or refresh-token flows.** The demo authenticates with a plain
  email/password. Real auth is usually the first thing you have to build yourself.
- **No mobile, no visual regression, no load testing.** Different tools, different
  article.
- **Parallelism is demonstrated on a public demo.** Registering a user per run works
  here; your environment may have shared entities, tenant limits, or a seed job that
  makes the answer different. The _principle_ transfers, the implementation may not.
- **The pipeline artifacts under `docs/` are a worked example, not full coverage.**
  `auth` has the whole chain — checklist, cases, plan; the other features have their
  verified context map only. That is what one feature through the pipeline looks like.
- **34 green tests is a skeleton, not coverage.** Which of your scenarios deserve
  automation is a question about your product and your risks — the one part of this
  that genuinely cannot be copied.

## Related writing

- [Anyone Can Build. Almost No One Can Maintain: The Real Cost of AI Coding](https://medium.com/@hamsterhany/anyone-can-build-almost-no-one-can-maintain-6c664ff14c03)
- [Test Automation: How to Turn Regression Routine into a Reliable System](https://medium.com/@hamsterhany/test-automation-how-to-turn-regression-routine-into-a-reliable-system-6305c96187c3)
- [Your Automated Tests Are Begging for a Pipeline](https://medium.com/@hamsterhany/your-automated-tests-are-begging-for-a-pipeline-how-to-stop-being-a-human-ci-a7ede1aad0f3)
- [The Three Pillars of QA](https://medium.com/@hamsterhany/the-three-pillars-of-qa-why-testing-alone-is-never-enough-68b454256e12)

## License
**AI Disclosure: The code in this repository was primarily generated with the assistance of AI tools, based on architectural decisions, prompts, and iterative modifications provided by the project maintainer.**
**MIT — see [LICENSE](LICENSE).**

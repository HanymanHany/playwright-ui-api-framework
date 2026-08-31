---
name: flake-hunt
description: 'Proves — or disproves — that the suite is genuinely isolated, by running it repeatedly under full parallelism and comparing the results run to run. A test that passes four times and fails once is not flaky; it is sharing something, and this skill finds out what.'
when_to_use: 'Use when a test passes locally but fails in CI, when the same spec gives different results on different runs, when the user says a test is flaky or unstable, before trusting a new spec, or after changing anything in global-setup, fixtures or the data snapshot.'
argument-hint: '[spec-or-empty-for-all] [runs, default 5]'
model: sonnet
allowed-tools: Read Grep Glob Bash(npx playwright test:*) Bash(git diff:*)
---

<!-- Model: sonnet. The loop is mechanical; the diagnosis is a lookup in the table
     below, which encodes what has already gone wrong here. What this skill must not do
     is get creative — the whole point is a clean signal about isolation. -->

`retries: 0` and `fullyParallel: true` are the two decisions this framework is built on
(`.claude/rules/architecture.md`, sections 1-2). They are only worth anything if someone
checks them. This is that check, and it exists because a single green run cannot tell
the difference between "isolated" and "lucky".

## Constants

```
RUNS = 5        # default; 3 is the minimum that means anything
WORKERS = 4     # the CI worker count — the whole point is running the way CI does
```

## Phase 1 — Establish the baseline

```bash
npx playwright test <target> --workers=4 --reporter=line
```

Record: pass/fail per test, and total duration. A failure on run 1 is not flakiness —
it is a broken test. Stop and hand it to the test-fixing stage instead; this skill
answers a different question.

Exclude the tests that fail on purpose, or every run reports the same three failures
and buries the signal:

```bash
npx playwright test <target> --workers=4 --grep-invert @demo --reporter=line
```

## Phase 2 — Repeat

Run the same command `RUNS` times. Do not change anything between runs — not the
worker count, not the order, not the data. Two runs of the same command that disagree
are the entire finding.

Playwright's own repeat flag is the cheaper version when the target is a single file:

```bash
npx playwright test <spec> --workers=4 --repeat-each=5 --reporter=line
```

The difference matters: `--repeat-each` re-runs the test inside one session, so it
catches intra-run collisions. Separate invocations also re-run `global-setup`, which is
what catches state leaking between runs — a user, a favorite or a cart that outlived its
own suite. Run both when the suite as a whole is under suspicion.

## Phase 3 — Classify every test that was not green every time

| Pattern across runs                       | What it means                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Fails always                              | Not flaky. A broken test or a real defect                                                      |
| Fails only at `--workers=4`, never at 1   | Two tests share an entity. `PRODUCT_ALLOCATIONS` in `utils/data-snapshot.ts` is the first stop |
| Fails only on the slowest run             | A hoisted token. JWT TTL is 300s — `getToken()` at the point of use                            |
| Fails only on runs 2+                     | State survived teardown. Check `global-teardown` ordering and 404 tolerance                    |
| Fails on a different test each time       | A global assertion — a count that other tests move under it                                    |
| Fails with `ECONNRESET` / `fetch failed`  | The public demo, not the suite. Note it, do not "fix" it, never add a retry for it             |
| Fails only when another spec runs with it | Cross-file collision — the two specs want the same product or the same account                 |

## Phase 4 — Report

```
Runs: N at 4 workers
Stable:   [tests green in every run]
Unstable: [test → failure rate (e.g. 2/5) → the row above that matches → the file to look in]
Product:  [failures that look like real defects rather than isolation problems]
```

Never propose `retries` as the outcome. A test that needs a retry is reporting an
isolation problem, and this skill exists precisely to name that problem, not to mute it.
If nothing can be found, say so plainly — an unexplained 1/5 is still a finding, and it
belongs in the report rather than in the reader's imagination.

---
name: run-tests
description: 'Runs Playwright specs one test at a time, diagnoses each failure against the failure modes this project actually produces, applies at most two focused fixes per test, then re-runs under full parallelism and reports honestly what is still broken.'
when_to_use: 'Use when the user asks to run tests, fix failing tests, says a test is red or broken, pastes Playwright failure output or a locator timeout, or asks why a spec fails. Not for writing new tests.'
argument-hint: '[spec-path-or-feature]'
model: sonnet
allowed-tools: Read Edit Grep Glob Bash(npx playwright test:*) Bash(npm run typecheck) Bash(npm run lint)
---

<!-- Model: sonnet. A tight mechanical loop — run, read the error, apply one focused
     fix, run again. The diagnostic table below encodes the judgment; the loop itself
     does not need to invent any. The hard stop after two attempts exists for the
     same reason: past that point it is guessing, and guessing is expensive. -->

## Constants

```
MAX_FIX_ATTEMPTS = 2   // per test: initial run + up to 2 fix cycles
WORKERS = 1            // during iterative debugging — isolate failures
```

## Phase 0 — Pre-flight

```bash
npm run typecheck
npm run lint
```

Fix ALL static errors before running anything. A run started with a type error tells
you about the type error, slowly.

**The `@demo` tests fail on purpose.** `tests/demo/demo-failure.api.spec.ts` and
`tests/demo/demo-failure.ui.spec.ts` exist to document what a failure looks like in the
report. A full local run is therefore red by design: 34 passed, 3 failed. Never
diagnose them, never fix them, never skip them — report them as expected and move on.
When the red is in the way, run `npm run test:green`.

## Phase 1 — Discover tests

Parse the spec file, list test titles in order, show the list.

## Phase 2 — Per-test protocol

```bash
npx playwright test "<spec>" --workers=1 --grep "<escaped title>"
```

`--grep` takes a **regular expression**, and Playwright matches it against the full
title — which in this project always starts with `[Section / SubSection]`. Pasting a
title verbatim makes `[UI / Auth / Login]` a character class, and the filter silently
matches the wrong tests or nothing at all. Escape `[ ] ( ) . * + ? | $ ^` first, or
grep on a distinctive fragment of the test name only:

```bash
npx playwright test tests/auth/login.ui.spec.ts --workers=1 --grep "signs in with valid"
```

Confirm the selection before trusting the result — the run must report exactly the one
test that was intended:

```bash
npx playwright test "<spec>" --grep "<pattern>" --list
```

PASS → `✓`, next test.
FAIL → read the error, the trace, and the attached `browser-console` before touching
anything. Then match it against the failure modes this project actually produces:

| Symptom                                       | Most likely cause                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Locator timeout                               | Locator not in context.md, or the UI changed. Re-verify in the live DOM — never invent a new selector |
| `waitForResponse` timed out, "browser closed" | The form validated client-side and sent nothing. The method should return `null`, not hang            |
| 401 mid-run                                   | A token was hoisted into a variable. It must be `getToken()` at the point of use — TTL is 300s        |
| 4xx on a create call                          | Two tests share an entity. Check `PRODUCT_ALLOCATIONS` in `utils/data-snapshot.ts`                    |
| Assertion sees stale content                  | Async re-render — wrap the trigger in `waitForResponse`, or settle with `expect.poll`                 |
| "violates the spec" / "missing from the spec" | Real contract drift. Do NOT adjust the test to match — report it                                      |
| `fetch failed`, `ECONNRESET`                  | The network, not the code. Re-run once; do not "fix" it and never add a retry for it                  |
| Assertion ran against the wrong browser       | Mixing the `guest` fixture with the default `page` — they are different contexts                      |

Apply ONE focused fix, re-run. After MAX_FIX_ATTEMPTS — STOP fixing that test, record
the problem, move to the next one.

Absolute rules while debugging:

- NEVER mark a failing test as skipped to make the run green
- NEVER raise `retries` to make a test pass
- NEVER weaken an assertion to fit observed behaviour without saying so out loud.
  If the product is wrong, the test staying red is the correct outcome

## Phase 3 — Confirm under parallelism

Passing at `--workers=1` proves the logic. It proves nothing about isolation.
Run the file the way CI will:

```bash
npx playwright test "<spec>"        # uses the configured worker count
```

Then run it a second time. A test that passes once and fails once is not "flaky" —
it is sharing something, and Phase 2's fourth row says where to look.

## Phase 4 — Final report

```
✓ passed: [list]
✗ stuck:  [test → root cause hypothesis → what I tried → what is needed]
⚠ product: [anything that looks like a real defect rather than a test problem]
```

Be honest in the third bucket. A test suite whose author quietly bends assertions to
match the app is worth less than no suite at all.

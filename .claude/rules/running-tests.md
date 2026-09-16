# Running and Fixing Tests

The operating manual for every run of this suite: how to execute it, how to read a
failure, how far to go fixing one, and how to tell a broken test from an isolation
problem.

This used to be two skills — `/run-tests` and `/flake-hunt`. Neither contained a
decision: "run it, read the error, apply one focused fix, stop after two" is the same
procedure whoever runs it and whatever the reason. A procedure with no human gate in it
is a rule, not a command, and a rule can be read by every skill that needs it instead of
being a button somebody has to remember to press.

Read by `/autotests` (phase 6, taking new code to green) and by `/test-code-review`
(when a finding needs to be reproduced).

## Constants

```
MAX_FIX_ATTEMPTS = 2   # per test: the initial run plus at most two fix cycles
WORKERS = 1            # while diagnosing — isolate the failure
WORKERS = 4            # while confirming — this is what CI does
FLAKE_RUNS = 5         # repeats when isolation is in question; 3 is the minimum that means anything
```

## Before running anything

```bash
npm run gates    # typecheck + lint + format:check + check:tags
```

Fix every static error first. A run started with a type error tells you about the type
error, slowly.

**The `@demo` tests fail on purpose.** `tests/demo/demo-failure.api.spec.ts` and
`tests/demo/demo-failure.ui.spec.ts` document what a failure looks like in the report, so
a full local run is red by design: 34 passed, 3 failed. Never diagnose them, never fix
them, never skip them. When the red is in the way, run `npm run test:green`; CI excludes
them via `grepInvert` in `playwright.config.ts`.

## One test at a time

```bash
npx playwright test "<spec>" --workers=1 --grep "<escaped title>"
```

`--grep` takes a **regular expression** and Playwright matches it against the full title,
which in this project always starts with `[Section / SubSection]`. Pasting a title
verbatim turns `[UI / Auth / Login]` into a character class, and the filter then silently
matches the wrong tests or none at all. Escape `[ ] ( ) . * + ? | $ ^`, or grep on a
distinctive fragment instead:

```bash
npx playwright test tests/auth/login.ui.spec.ts --workers=1 --grep "signs in with valid"
```

Confirm the selection before trusting the result — the run must report exactly the one
test that was intended:

```bash
npx playwright test "<spec>" --grep "<pattern>" --list
```

## Reading a failure

Read the error, the trace and the attachments before touching anything. A failing test
carries two of them that answer most questions on their own:

- **`api-traffic`** — every API call the test made, worst first, with both bodies and a
  `curl` that replays it. If the failure is "the list is empty", this is where the
  request that should have filled it either did not happen or came back 4xx.
- **`browser-console`** — JS errors from the page. A locator that "timed out" is
  regularly a component that threw during render.

Then match the symptom against what this project actually produces:

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

Apply ONE focused fix, then re-run. After `MAX_FIX_ATTEMPTS` stop fixing that test,
record the problem and move to the next one. Past that point it is guessing, and guessing
is expensive.

## Absolute rules while fixing

- NEVER mark a failing test as skipped to make the run green
- NEVER raise `retries` to make a test pass
- NEVER weaken an assertion to fit observed behaviour without saying so out loud.
  **If the product is wrong, the test staying red is the correct outcome**

A suite whose author quietly bends assertions to match the app is worth less than no
suite at all, because it produces confidence that nothing supports.

## Confirming under parallelism

Passing at `--workers=1` proves the logic. It proves nothing about isolation.

```bash
npx playwright test "<spec>"        # the configured worker count — what CI does
```

Run it a second time. A test that passes once and fails once is not "flaky" — it is
sharing something, and the table below says where to look.

## When isolation itself is in question

`retries: 0` and `fullyParallel: true` (`.claude/rules/architecture.md`, decisions 1-2)
are only worth something if somebody checks them, because a single green run cannot tell
the difference between "isolated" and "lucky". Run this after changing anything in
`global-setup`, the fixtures or the data snapshot, and whenever the same spec gives
different answers on different runs.

```bash
npx playwright test <target> --workers=4 --grep-invert @demo --reporter=line
```

Repeat it `FLAKE_RUNS` times, changing nothing between runs — not the worker count, not
the order, not the data. Two runs of the same command that disagree are the entire
finding. A failure on the very first run is not flakiness; it is a broken test, and it
goes back to the section above.

For a single file, Playwright's own repeat flag is cheaper:

```bash
npx playwright test <spec> --workers=4 --repeat-each=5 --reporter=line
```

The difference matters: `--repeat-each` re-runs the test inside one session, so it
catches collisions inside a run. Separate invocations also re-run `global-setup`, which
is what catches state leaking between runs — a user, a favorite or a cart that outlived
its own suite. Run both when the suite as a whole is under suspicion.

### Classify every test that was not green every time

| Pattern across runs                       | What it means                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Fails always                              | Not flaky. A broken test or a real defect                                                      |
| Fails only at `--workers=4`, never at 1   | Two tests share an entity. `PRODUCT_ALLOCATIONS` in `utils/data-snapshot.ts` is the first stop |
| Fails only on the slowest run             | A hoisted token. JWT TTL is 300s — `getToken()` at the point of use                            |
| Fails only on runs 2+                     | State survived teardown. Check `global-teardown` ordering and 404 tolerance                    |
| Fails on a different test each time       | A global assertion — a count that other tests move under it                                    |
| Fails with `ECONNRESET` / `fetch failed`  | The public demo, not the suite. Note it, do not "fix" it, never add a retry for it             |
| Fails only when another spec runs with it | Cross-file collision — the two specs want the same product or the same account                 |

Never propose `retries` as the outcome. A test that needs a retry is reporting an
isolation problem, and naming that problem is the whole point. If nothing can be found,
say so plainly — an unexplained 1/5 is still a finding, and it belongs in the report
rather than in the reader's imagination.

## Reporting

```
✓ passed:  [tests green at 1 worker and at 4]
✗ stuck:   [test → root-cause hypothesis → what was tried → what is needed]
⚠ product: [anything that looks like a real defect rather than a test problem]
⚠ unstable:[test → failure rate (e.g. 2/5) → matching row above → the file to look in]
```

Be honest in the last two buckets. They are the only part of the report that carries
information the reader does not already have.

---
name: test-code-review
description: 'Reviews changed test code against the rules of THIS project — the ones no general reviewer can know: parallel-safe data isolation, JWT lifetime, browser context boundaries, locator provenance, cleanup ownership. Every item on its list has already broken this suite at least once.'
when_to_use: 'Use after writing or changing anything under tests/, pages/, api/, fixtures/ or utils/, when the user asks to review test code, check the diff before committing, or asks whether a test is parallel-safe, whether an assertion actually proves anything, or whether cleanup is correct.'
argument-hint: '[optional path or feature]'
paths: tests/**, pages/**, api/**, fixtures/**, utils/**, data/**
model: opus
allowed-tools: Read Edit Grep Glob Bash(git diff:*) Bash(git status:*) Bash(npm run typecheck) Bash(npm run lint) Bash(npm run format:check) Bash(npm run format) Bash(npm run lint:fix)
---

<!-- Model: opus. The value of this step is the part tooling cannot see — an assertion
     that passes for the wrong reason, a token hoisted out of getToken(), two tests
     quietly sharing an entity. Those read as perfectly ordinary code. Missing them is
     what this skill exists to prevent, so it gets the strongest model in the pipeline.

     Scope note: this skill deliberately does NOT re-do what already exists. General
     correctness, dead code and simplification are covered by the bundled /code-review;
     types, lint and formatting are covered by npm scripts and by CI. What is left is
     the domain knowledge, and that is the entire content below. Running both is the
     intended workflow, not redundancy. -->

Delegate to the **reviewer** agent (`.claude/agents/reviewer.md`) when available.

## Step 1 — Preconditions

```bash
git diff HEAD --stat                                    # what changed
npm run typecheck && npm run lint && npm run format:check
```

Nothing changed → say so, stop. Gate failures are Critical and are fixed first
(`npm run format`, `npm run lint:fix` for the auto-fixable ones): reviewing code that
does not compile wastes the expensive part of this step.

## Step 2 — Critical: a green test that proves nothing, or a latent race

Ordered by how expensive each is to discover later, not by how obvious it is to spot.
Every one has actually happened in this project.

1. **Assertion strength.** Does the check establish the claim in the title? "Redirected
   to /account" does not prove _who_ is signed in. A success toast does not prove the
   data was persisted. If an API can confirm it, it should.
2. **Shared entities.** Two tests using the same product, account or record.
   `fullyParallel` is ON. Check `PRODUCT_ALLOCATIONS` in `utils/data-snapshot.ts` — new
   consumers are registered there, never sliced by hand in a spec.
3. **Token lifetime.** `getToken()` at the point of use only. A token stored in a
   variable at the top of a describe survives four minutes and then does not.
4. **Browser context mixing.** Page objects from the `guest` fixture and the default
   `page` live in different contexts. Asserting across them tests the wrong browser.
5. **Global assertions.** Counting a list, asserting "exactly one favorite". Assert on
   the entity this test created, by id.
6. **Cleanup.** Everything created carries `RUN_ID`, is removed in `afterAll`, and the
   removal tolerates 404 and runs as an actor allowed to do it.
7. **Hardcoded reality.** A product name, a search term, a category id, a price typed
   into a test. All of it resolves from the snapshot or the API.
8. **Hand-written response types.** They belong in `api/types.ts`, derived from the
   generated schema. An interface declared in a spec file drifts silently.
9. **Locator provenance.** Every locator traces to `docs/context/<feature>/context.md`.
   One that does not is either invented or stale — both are findings.

## Step 3 — Important: correctness of form

10. `test`/`expect` imported from `fixtures/base.fixture` only
11. No locators in `.spec.ts`; locators are `private get` in page objects
12. No hardcoded UI strings or routes — from `data/`
13. `process.env` only in `config/env.ts`; timeouts from `config/timeouts.ts`
14. New page objects have `goto()` and `assertPageLoaded()`
15. Naming: `kebab-case.page.ts`, `PascalCasePage`, `clickX` / `fillX` / `assertX`
16. Steps use Prepare/Action/Verify prefixes; every test declares a tag
17. No `test.step` inside page objects
18. Async re-renders handled via `waitForResponse` or `expect.poll`

## Step 4 — Automatic rejection

```bash
git diff HEAD | grep -nE 'test\.only|retries:\s*[1-9]|test\.skip'
```

- `retries` raised, or a failing test skipped, to make a run green
- A `// MISSING:` locator replaced with a guess instead of a fresh exploration run
- An assertion weakened to match observed behaviour, without that being called out

Any of these is reported and reverted, never negotiated.

## Step 5 — Fix and report

Fix Critical immediately. For Important, fix the unambiguous ones and list the rest with
a concrete proposal. Re-run the gates. Report what was found, what was fixed, and what
still needs a human decision.

## Step 6 — Record the review

Only when nothing Critical is left open:

```bash
node .claude/scripts/review-marker.mjs write
```

This records a fingerprint of exactly what was reviewed. The commit stage checks it and
refuses to commit a diff that has changed since — so "fix, then review again" is
enforced rather than remembered. If Critical findings remain, do **not** write the
marker: the honest state is "reviewed, still broken".

Never commit — that is a separate stage, with its own approval.

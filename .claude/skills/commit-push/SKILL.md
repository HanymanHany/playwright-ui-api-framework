---
name: commit-push
description: 'Cleans disposable artifacts, screens the staged diff for secrets and test-suite smells, proposes a conventional commit message for confirmation, and pushes only after a separate explicit approval.'
argument-hint: '[optional message hint]'
model: haiku
disable-model-invocation: true
allowed-tools: Bash(git status:*) Bash(git diff:*) Bash(git add:*) Bash(git commit:*) Bash(git branch:*) Bash(npm run clean)
---

<!-- Model: haiku. Stage, summarise the diff, write a message, ask, push. There is no
     judgment left in this step — /test-code-review already made it. On a large
     model is paying for reasoning that has nowhere to go. -->

## Step 0 — The diff must already have been reviewed

```bash
node .claude/scripts/review-marker.mjs check
```

Non-zero exit: stop. Say which case it is — never reviewed, reviewed against an older
commit, or reviewed and then edited — and hand back to the review stage. Do not review
it here instead: this step runs on a small model precisely because every judgment call
was already made upstream, and re-making them cheaply is worse than not making them.

The two stages stay separate on purpose. A step that starts out intending to commit is
measurably worse at finding reasons not to.

## Step 1 — Cleanup

```bash
npm run clean
```

Removes `tmp/`, `test-results/`, `playwright-report/`, `allure-results/`,
`allure-report/`, `.playwright-mcp/`. All gitignored and disposable.

Use the npm script, not `rm -rf` — this project is developed on Windows and shell
built-ins are not portable. The script is plain Node and runs anywhere.

## Step 2 — Show state

```bash
git status && git diff --stat HEAD && git branch --show-current
```

## Step 3 — Check what is about to be committed

Run the screen, do not eyeball the diff. Both commands must print nothing:

```bash
git diff --cached --name-only | grep -E '^\.env|^\.auth/|schema\.d\.ts$'
git diff --cached | grep -nE 'test\.only|retries:\s*[1-9]|^\+\s*//\s*(test|it)\('
```

What each hit means:

- `.env` / `.auth/` — files that are gitignored for a reason. Stop.
- `schema.d.ts` — generated, not edited. A legitimate change comes from
  `npm run api:types` and belongs in its own commit.
- `test.only` — the rest of the suite is disabled and CI will still be green.
- raised `retries` — a race is being hidden rather than fixed.
- a commented-out test — deleted coverage that still looks present.

Any hit: stop and report it instead of committing. Do not commit "the rest" as a
workaround — the diff is reviewed as a whole or not at all.

## Step 4 — Propose a commit message

Format: `<type>: <short description>` — `feat` / `fix` / `test` / `refactor` /
`docs` / `chore`, at most 72 characters.

> "Proposed commit message: [message]. OK or change it?"

**Wait for confirmation.**

## Step 5 — Commit

```bash
git add <specific files>   # NEVER blind -A
git commit -m "<confirmed message>"
```

## Step 6 — Push (a separate confirmation)

> "Committed to [branch]. Push to remote?"

Only after an explicit "yes" / "push":

```bash
git push origin <branch>
```

## Rules

- Never push without explicit approval; approval does not carry over to the next commit
- Never `--amend`, never `--no-verify`
- Pushing to `main` → warn and double-confirm

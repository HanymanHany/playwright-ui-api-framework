---
name: setup
description: 'Takes a freshly cloned copy of this repository to a green test run: checks the toolchain, installs dependencies and the browser, verifies the target demo and its OpenAPI spec are reachable, runs the smoke suite, and explains every failure in terms of what to do about it.'
when_to_use: 'Use on a fresh clone, when the user asks how to start or set up the project, when npm test fails before any test runs, when global-setup errors out, when the browser is missing, or when the browser tooling for exploration does not respond.'
argument-hint: '[optional: what is failing]'
model: sonnet
allowed-tools: Read Write Grep Glob Bash(node:*) Bash(npm:*) Bash(npx playwright install:*) Bash(npx playwright test:*) Bash(curl:*) Bash(git status:*)
---

<!-- Model: sonnet. Every step here has a known expected output and a known remedy.
     This is a checklist executed carefully, not a diagnosis invented from scratch. -->

The target is a **public demo application**, so nothing has to be provisioned: no
account to create, no seed data, no secrets. Anything that fails here is local — the
toolchain, the browser, or the network between them and the demo.

Work top to bottom. Each step states what "good" looks like; on a mismatch, apply the
remedy and re-run that step before moving on. Report at the end what was already fine,
what was fixed, and what still blocks a green run.

## Step 1 — Toolchain

```bash
node -v && npm -v
```

Node 20 or newer (CI runs 22). Older than 20 — stop and say so: the remedy is a Node
upgrade, and no later step will work around it.

## Step 2 — Dependencies

```bash
npm ci || npm install
```

`npm ci` is the correct command when `package-lock.json` is present — it installs
exactly the locked versions. Fall back to `npm install` only if the lockfile is missing
or out of sync, and mention that this happened.

## Step 3 — Browser

```bash
npx playwright install chromium
```

Playwright downloads its own Chromium; a system Chrome does not count. On Linux, add
`--with-deps` when the launch later fails on missing shared libraries.

## Step 4 — Environment

`.env` is **optional** — `config/env.ts` carries a working default for every variable.
Create one only when the defaults have to change:

```bash
cp .env.example .env    # only if the user wants to override the defaults
```

Never write private values into it and never commit it. The admin account in
`.env.example` is published by the demo maintainers and is used by teardown only.

## Step 5 — The target has to be reachable

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://practicesoftwaretesting.com
curl -s -o /dev/null -w '%{http_code}\n' https://api.practicesoftwaretesting.com/products?page=1
curl -s -o /dev/null -w '%{http_code}\n' https://api.practicesoftwaretesting.com/docs
```

Three `200`s. Anything else means the whole suite will fail for reasons that have
nothing to do with the code:

| Result             | What it is                                                                     |
| ------------------ | ------------------------------------------------------------------------------ |
| Connection refused | No network, or a corporate proxy. The suite cannot run offline                 |
| 5xx                | The public demo is down. Wait — there is nothing to fix here                   |
| 4xx on `/docs`     | The spec moved. Type generation and the contract tests both depend on this URL |

## Step 6 — Static gates

```bash
npm run typecheck && npm run lint && npm run format:check
```

These need nothing but the install. A failure here on an untouched clone means the
install is incomplete, not that the code is wrong.

## Step 7 — First run

```bash
npm run test:smoke
```

This exercises the parts most likely to be misconfigured: `global-setup` registers a
run user, logs in through the UI, writes the data snapshot and downloads the OpenAPI
document into `.auth/`.

| Failure                                  | Cause and remedy                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `Executable doesn't exist`               | Step 3 did not run, or ran for a different Playwright version. Re-run it      |
| global-setup fails at registration       | The demo is unreachable or rate-limiting. Re-check Step 5, then wait a minute |
| global-setup fails writing `.auth/`      | Directory permissions in the clone                                            |
| Contract tests fail on a clean clone     | The live spec moved: `npm run api:types`, then commit the regenerated file    |
| Teardown warns it cannot remove the user | Expected when admin is unavailable — a warning, not a failure. Nothing to fix |

Then the full suite: `npm test` — about 21 seconds at four workers.

## Step 8 — Browser tooling for exploration (optional)

Only needed for the exploration stage, not for running tests. Playwright MCP is
configured in `.mcp.json` and starts with the session; confirm it responds by
navigating to `about:blank`. If it does not, exploration falls back to one-off scripts
in `tmp/` — see `.claude/rules/browser.md`. Do not block setup on this.

## Step 9 — Report

```
Ready:    [steps that were already correct]
Fixed:    [what this run installed or created]
Blocked:  [what still fails → which step → what the user has to do]
Next:     npm test, or the exploration stage for a feature that has no context.md yet
```

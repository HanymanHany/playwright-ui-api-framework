# Browser Operating Manual

The shared instruction set for all live browser work: navigating pages, studying UI
behaviour, and collecting or verifying locators.

This used to be a skill. It was never invoked by anyone — `/checklist` and the `explorer`
agent read it, and `/autotests` reads it when diagnosing a locator failure. A file that is
only ever read is a rule, not a procedure, so it lives here.

## Tooling

Primary: **Playwright MCP** ([microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)),
configured in `.mcp.json` and started with the session. It gives the exploring agent real
browser control — `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`,
`browser_evaluate`, `browser_take_screenshot` — against an accessibility snapshot rather
than pixels, which is why locator work through it is exact rather than approximate.

Health check before any session: `browser_navigate → about:blank`. If it fails — stop and
report: "Playwright MCP is not responding. Check `.mcp.json` and restart the session."

Fallback when MCP is unavailable: write a one-off script in `tmp/` using `@playwright/test`'s
`chromium.launch()` and run it with `npx tsx tmp/<name>.ts` — dump `[data-test]` elements per page.
The fallback exists so a broken MCP does not block the pipeline, not as an equal option: it
sees one page per script run and cannot interact, so behaviour mapping through it is guesswork.

## Which address to open

Never a hardcoded host. The target comes from `config/env.ts`:

- `UI_BASE_URL` — default `https://practicesoftwaretesting.com`
- `API_BASE_URL` — default `https://api.practicesoftwaretesting.com`
- `OPENAPI_URL` — default `${API_BASE_URL}/docs`

On a real project these are the only lines that change: put your local stand or test
environment in `.env` (`UI_BASE_URL=http://localhost:4200`, `API_BASE_URL=http://localhost:8091`)
and everything — the suite, the exploring agent, type generation — follows. Nothing else
in the project knows a hostname.

Two options worth knowing about when pointing this at a company environment
(see the playwright-mcp README for the full list, they go in `.mcp.json` as extra args):

- `--allowed-origins` — a semicolon-separated allowlist. The agent then physically cannot
  navigate anywhere but your stand, which is the difference between a policy and a fact
- `--storage-state` / `--isolated` — start each session from a saved session or from a
  clean profile. Useful where login goes through SSO and cannot be scripted per run

## Navigation sequence for each page

1. `browser_navigate` → target URL (base from `config/env.ts` defaults)
2. Screenshot → confirm the page loaded (no login redirect, no error state)
3. Snapshot (accessibility tree) → collect interactive elements
4. Scroll to the bottom — paginated/lazy content
5. Interact with EVERY element in scope; snapshot again after each state change

## Login state

- Logged-in flows: log in once via the UI form (credentials from `config/env.ts`), stay in the session
- Logged-out flows: fresh context / cleared storage
- Never click Logout mid-session — open a new context instead

## For every interactive element record BOTH (same moment, never separately)

**Behavior note** — what does it do?

- Button: modal opened / navigation / inline change / form submit / nothing visible
- Modal: trigger, contents, close methods (✕ / Cancel / Escape / outside click) — test each
- Form: required fields, validation messages, behavior on submit and on cancel
- Table/list: row click target, per-row actions, search behavior (live or on submit), pagination
- Toggle/select: applies immediately or needs Save? visual confirmation?

**Locator check** — what selects it?

- Read `data-test` from the DOM: `document.querySelectorAll('[data-test="x"]').length > 0`
- Note parametrized patterns (`category-{id}`, `product-{id}`, `favorite-{id}`) and WHERE the id comes from (API endpoint)

## Locator priority (this app has rich data-test coverage)

```typescript
page.locator('[data-test="add-to-cart"]') // 1 — data-test (preferred here)
page.getByRole('button', { name: 'Search' }) // 2 — semantic role
page.locator('[data-icon="edit"]') // 3 — other data-*
page.locator('.card__title') // 4 — stable CSS class
page.locator('//div[@class="grid"]/a[1]') // 5 — XPath, last resort with a comment
```

## Safety rules

- Never click destructive irreversible actions (delete account, factory reset)
- The environment is a SHARED public demo — clean up anything you create (favorites, cart)
- If a page is broken: screenshot, note it, navigate directly to the next URL

## Output

Browser findings always land in `docs/context/<feature>/context.md`:
`## Routes`, `## data-test Attributes Map`, `## UI Behavior Map`, `## Forms`,
`## Test Data Patterns`, `## Known Pitfalls`. Merge with existing content — never overwrite verified sections.

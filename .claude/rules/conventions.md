# Coding Conventions

Strict rules, enforced when writing tests and during every `/test-code-review`.

## Imports

```typescript
// CORRECT — always from our fixtures
import { test, expect } from '../../fixtures/base.fixture'
// WRONG — bypasses custom fixtures, page override and Allure labels
import { test, expect } from '@playwright/test'
```

Types (`Page`, `Locator`) may come from `@playwright/test`.
API types come from `api/types.ts` — never re-declare a response shape by hand.

## Locators — priority is by STABILITY, not by selector type

The question is always the same: **what survives a frontend refactor?**

1. **A real `id`** — `#login-button`. Only if it is authored, not generated:
   `#mat-input-47` is not an id, it is a counter.
2. **`data-test` / `data-testid`** — a contract the frontend agrees not to break.
   If the app has none, go and ask the developers to add them. That is not a
   favour, it is an investment in stability for both sides.
3. **`getByRole` + accessible name** — semantic, and it checks accessibility on
   the way past.
4. **A stable, meaningful class** — `.product-card__title` yes;
   `.mt-4`, `.flex`, `.css-1x7g2h` no. Utility and hashed classes are not selectors.
5. **Structural CSS → XPath** — last resort, and only with a comment saying why.

**For this application, `data-test` comes first in practice.** Toolshop covers almost
every element with it, so it is more stable here than the ids. That is a property of
this app, not a universal law — on an app without `data-test`, the same rule puts ids
and roles at the top. Re-derive the order per project; do not copy it.

Never select by visible text when a value exists. The country dropdown labels NL as
"Netherlands (the)" and the app ships eight locales — `selectOption('NL')` survives a
language change, `{ label: 'Netherlands' }` never even worked.

### Where locators live

- Always `private get` getters in page objects — never fields (they go stale after
  navigation), never public
- NEVER call `page.locator()` / `page.getBy*()` inside a `.spec.ts` file
- Parametrised locators are private methods: `private favoriteCard(id: string): Locator`
- Repeated per-card elements (`product-name`, `product-price`) — always scoped to
  the card locator
- Locator values come ONLY from `docs/context/<feature>/context.md`. A locator that
  is not there is reported as missing, never invented.

## Where a spec file goes

- `tests/<feature>/<name>.<layer>.spec.ts` — feature in the folder, layer in the suffix
- Layers: `.api.spec.ts`, `.ui.spec.ts`, `.hybrid.spec.ts`. The Playwright projects
  match the suffix, so a wrong suffix silently puts the test in the wrong project —
  an API test named `.ui.spec.ts` will launch a browser it never uses
- A new feature is a new folder. Do not add a file to a neighbouring feature because
  it is "close enough"

## Page objects

- Extend `BasePage`; constructor takes only `page: Page`
- An element present on every page belongs in `pages/components/`. Page objects
  compose components as `readonly x: XComponent` — never inherit them, never copy the
  locator into whichever page needed it first
- A component that exactly one page uses is not a component. Leave it in that page
- Every page object has `goto()` (URL from `data/routes.data.ts`) and
  `assertPageLoaded()` (soft checks via `assertAllElementsVisible`)
- Methods named after user actions: `clickX()`, `fillX()`, `assertX()`
- Assertions inside page objects call `protected` BasePage helpers; tests call only
  the page object's named `assert*` methods
- Logger: `this.log.step('...')` for user-visible actions
- No `test.step()` inside page objects — they are pure UI wrappers
- Form fields are asserted with `assertInputHasValue` (`toHaveValue` retries),
  never by reading `inputValue()` and comparing

## Test structure

```typescript
test('scenario description', { tag: ['@ui', '@smoke'] }, async ({ catalogPage }) => {
	await test.step('Prepare: ...', async () => { ... })
	await test.step('Action: ...', async () => { ... })
	await test.step('Verify: ...', async () => { ... })
})
```

- One top-level `test.describe('[Section / SubSection]')` per file. This is not
  cosmetic: `core/allure-labels.ts` parses it into the report's feature and story.
- Step prefixes `Prepare:` / `Action:` / `Verify:` — sentences, not code
- Every test declares at least one tag; severity in the report is derived from it
- Tests are independent. `fullyParallel: true` means two tests in the same FILE can
  run at the same time — never rely on ordering or on another test's state

## Test data

- Reference data: `readDataSnapshot()` in `beforeAll` — built once by global-setup
- Mutable state (favorites, cart, profile): created live via typed API clients
- Two spec files must never touch the same entity. Products come from
  `productsFor(snapshot, '<consumer>')`; a new consumer is REGISTERED in
  `PRODUCT_ALLOCATIONS` in `utils/data-snapshot.ts`, never sliced by hand in a spec.
  Index arithmetic spread across files is a contract that nothing checks
- Account payloads come from `data/test-user.data.ts` — one definition, three consumers
  (global-setup, the API registration spec, the UI registration spec)
- Search terms, category ids, prices and product names are DERIVED from the snapshot
  or the API (`pickSearchTerm`, `pickLeafCategory`), never typed into a test
- Anything created must be namespaced with `RUN_ID` and removed in `afterAll`
- Cleanup tolerates 404 (`.catch(() => {})`) — it must survive a mid-test failure
- Never assert absolute list counts. Assert on YOUR entity, by id
- No hardcoded UI strings or routes — `data/labels.data.ts`, `data/routes.data.ts`
- `process.env` only in `config/env.ts`
- Every waiting period from `config/timeouts.ts` — no inline millisecond literals

## Auth

- UI tests: authenticated by storageState as the run user — never log in inside a test
- Login/registration scenarios: the `guest` fixture (one shared logged-out context)
- API calls: `getToken()` at the point of use ONLY — JWT TTL is 300s

## Waiting

- NEVER `waitForTimeout` / sleep
- UI actions triggering XHR: `Promise.all([page.waitForResponse(...), action()])`
- Async re-renders (sort, filters): `expect.poll()` until the condition settles
- A form may validate client-side and send nothing. Waiting unconditionally for a
  response then hangs for the whole timeout and reports "browser closed", which
  explains nothing — return `null` and let the test assert on it

## Not allowed

- `test.only` in committed code
- `retries` > 0 to make a flaky test pass — fix the isolation instead
- Marking a failing test as skipped to make the run green
- `new SomePage(page)` in tests — use fixtures
- Editing `api/generated/schema.d.ts` by hand — run `npm run api:types`
- Assertions on shared/global counts on a shared environment

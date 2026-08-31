# Architecture — Key Decisions

Every entry answers "why is it like this", not "what is it". When a decision here
stops being true, change the code AND this file in the same commit.

## 1. Every run registers its own user

`global-setup` calls `POST /users/register` and the whole suite acts as that account.

The target is a public demo. `customer@practicesoftwaretesting.com` is used by
everyone reading the docs, by the demo's reseed job, and — the part that actually
bites — by all four of our own workers at once. One worker empties the cart while
another asserts it has a line, and you get a flake that reproduces once every twenty
runs and never on the machine of the person debugging it.

Retries would have hidden that. The fix is one level down: stop sharing.

Scaled up, this is the same move as a unique prefix or a dedicated tenant per run.
The implementation is environment-specific; the principle is not.

## 2. Isolation first, parallelism second — `fullyParallel: true`, `retries: 0`

The flag is only defensible because of decision 1. Turning it on before isolating
the data is how you buy a suite that passes locally and fails in CI once a week.

`retries: 0` is deliberate. A retry turns a real race into a green build and defers
the diagnosis to the day it is most expensive. If a test needs a retry to pass, it is
reporting an isolation problem and should be read that way.

Measured on this suite: 46s at one worker, ~21s at four. It plateaus at four because
34 tests are network-bound, not CPU-bound — more workers buy nothing here.

## 3. Types are generated from the live OpenAPI spec

`npm run api:types` regenerates `api/generated/schema.d.ts`. Never edit it by hand.

Hand-written response interfaces drift silently. The originals in this project
claimed `description` and `product_image` were required and typed `sub_categories`
wrongly — all three were wrong against the published spec.

`api/types.ts` narrows the generated types, because the spec marks almost nothing as
`required` and raw generated types force a `!` on every property access. The narrowing
is a claim, and claims need proof — which is decision 4.

The generated file is 4200 lines and that is fine: it is read by the compiler, not by
people (`npm run typecheck` takes two seconds), and the nine types anyone actually
works with live in the 80-line `api/types.ts` on top of it. Splitting it is not an
option anyway — the generator writes one file, and any hand-made split disappears on
the next regeneration.

It is kept out of the way rather than out of the repository: `.prettierignore` so
regeneration never produces a formatting diff, `.gitattributes` with
`linguist-generated=true` so it collapses in pull request diffs instead of burying the
real change, and a hook that refuses to edit it by hand.

## 3b. The HTTP layer is typed against the spec, not against strings

`api/client.ts` wraps `openapi-fetch`, so a path is checked at compile time:
`client.GET('/products/{productId}', { params: { path: { productId } } })`.

The predecessor took the path as a string, and that let `/products/{id}` through —
found later, at runtime, by a contract test. The same class of mistake now fails
`npm run typecheck` in two seconds with no server involved.

Migrating to it immediately surfaced a second one, which nothing else would have
caught: the catalog filter was calling `/products?by_category_slug={slug}`, and that
parameter **does not exist in the spec at all**. It works — the server accepts it —
and that is precisely the danger: a parameter that is not in the contract cannot drift
from the contract, it can only vanish one day without notice. The documented
`by_category` takes the category ID (a slug returns zero results, verified live), which
is also what the UI checkboxes carry. Undocumented behaviour is not a shortcut, it is
an unowned dependency.

What this layer deliberately does not do is validate at runtime — it trusts the types.
Adding Zod schemas would create a second hand-maintained description of the same
responses, which is the drift problem decision 3 already removed. Trust is verified
instead by decision 4, against the same document the types came from.

## 4. Contract tests prove what generated types only assert

Two different failures, two different mechanisms:

- spec says X, our code says Y → `npm run typecheck` after regenerating
- spec says X, the server says Z → `tests/contract/contract.api.spec.ts`, at runtime

The second is the expensive one: it is how a suite stays green for three weeks while
the mobile team is already broken. The very first run of this test caught a real
mismatch (`/products/{id}` vs `/products/{productId}`).

The spec is downloaded once in global-setup so all workers validate against the same
document — a contract test racing a deploy is worse than none.

## 5. JWT lifetime is 300 seconds — TokenProvider, not a token file

Verified live and asserted in `tests/auth/auth.api.spec.ts`: `exp - iat === 300`.

The obvious pattern — log every account in during global-setup, write tokens to a
file, read them synchronously in workers — does not survive this TTL. Workers either
race to rewrite the file or read a token that died four minutes ago.

So the file holds credentials and each worker keeps its own in-memory cache,
refreshing at 240s. Call `getToken()` at the point of use; hoisting it into a
long-lived variable reintroduces the bug the provider exists to prevent.

## 6. Two Playwright projects: api / ui

- `api` — no storageState, no browser; matches `*.api.spec.ts`
- `ui` — storageState preloaded; matches `*.ui.spec.ts` and `*.hybrid.spec.ts`

The projects match the **filename suffix**, not the folder, because specs are grouped
by feature (decision 12). Layer and feature are two independent axes and the filesystem
only has one; putting the feature in the path and the layer in the name keeps both
without nesting `tests/auth/api/` for a single file.

The console-capture logic lives in a `page` **override**, not an `auto` fixture. As an
auto fixture depending on `page` it silently launched a browser for all 21 API tests.
An override is lazy: only tests that touch a page create one.

Login and registration scenarios use the `guest` fixture — one fresh logged-out
context holding the login, register and account pages. All three share ONE context on
purpose: an earlier version handed out only a guest LoginPage, tests reached for the
regular `accountPage` afterwards, and the assertion ran against a browser that had
never seen the login.

## 7. Hybrid tests — the pattern this framework showcases

State is created via API (fast, deterministic), and the browser does only what is
actually under test. `tests/favorites/favorites.hybrid.spec.ts` creates a favorite with a POST
(~200ms instead of ~10s of clicking), asserts the exact card
`[data-test="favorite-{id}"]`, then verifies the UI delete propagated back through
`GET /favorites`.

Setup that is not under test should not be performed by clicking.

## 8. The UI is verified against API truth

Category checkboxes render as `[data-test="category-{categoryId}"]`, with ids from
`/categories/tree`. So UI tests must resolve ids through the API anyway — which makes
the honest version of the test the natural one: the snapshot gives the category, the
API gives the expected product subset, the grid must match it.

A hardcoded list of expected product names passes while the filter returns the wrong
subset, because the list was written by someone looking at the same wrong screen.

## 9. Snapshot reference data, never mutable state

`global-setup` fetches categories, brands and a page of products once into
`.auth/data-snapshot.json`. Specs read it synchronously in `beforeAll`.

What must never go in it: favorites, cart, profile. A snapshot of state that changes
is a stale assertion with a delay fuse.

## 10. Cleanup is ordered, and never throws

Entities first, as their owner; then the owner. A user cannot delete itself — the API
answers 403, verified — so `global-teardown` removes the run user with the admin role,
and logs a warning instead of failing when admin is unavailable.

Teardown that crashes turns a red test into a red run with a misleading cause.

## 11. Report metadata is derived, not written per test

`core/allure-labels.ts` computes severity, layer, feature and story from the tags and
the `[Section / SubSection]` describe title each test already declares. Per-test
`allure.severity()` calls go stale within a month and the report's filters quietly
become decorative.

`core/allure-categories.ts` encodes failure triage — contract drift, stale locator,
auth, data collision, product defect — so the report answers "is this us or them"
without a human doing it by hand every morning.

## 12. The rules that matter most are enforced, not written down

Everything above this line is prose. Prose holds exactly as long as the reader
remembers it, and the rules most worth keeping are the ones that get bent at the worst
moment — when something is in the way and there is a deadline.

So four of them are refused by a `PreToolUse` hook instead (`.claude/settings.json`,
`.claude/hooks/`):

- editing `api/generated/` — it is regenerated, and a hand edit makes the types
  disagree with the server silently, which is the exact failure the generator prevents
- editing `.env` or `.auth/` — machine-local state, rebuilt every run
- editing `package-lock.json` — npm writes it
- `git push --force`, `--no-verify`, `git commit --amend` — each destroys information
  somebody else will need

The hooks are plain Node with no dependencies, because this project is developed on
Windows and runs in CI on Linux; a guard that works on one of those is worse than none.

The same reasoning connects the last two stages. Review and commit stay separate — two
skills, two models, two human approvals, because a step that starts out intending to
commit is measurably worse at finding reasons not to. But nothing stopped a commit from
skipping the review entirely, which made the gate optional in practice. So the review
records a fingerprint of what it approved (`.claude/scripts/review-marker.mjs`), and
the commit stage refuses a diff that has changed since.

Not a lock — a question with an exact answer: _was this diff reviewed, or a different
one?_ That is the difference between a process and a habit.

## 13. Specs are grouped by feature; folders follow the product, not the tooling

`tests/auth/` holds `auth.api.spec.ts`, `registration.api.spec.ts`, `login.ui.spec.ts`
and `register.ui.spec.ts`. Everything about signing in lives in one directory.

The alternative — `tests/api/`, `tests/ui/`, `tests/hybrid/` — reads better on a
thirty-test suite, because it shows off the three layers. It stops working at scale for
a reason worth naming: **layer is a property of the test, feature is a property of the
product, and only one of them is a good filing system.** When a feature changes, its
tests change together and you want them together. Nobody has ever needed to change
"all the UI tests".

Measured against the same author's production suite: forty-one specs grouped by domain
(`cards`, `clients`, `managers`, `scanner`, `webhooks`), where `clients` alone holds
sixteen files. Grouped by layer that would be one flat `ui/` folder with forty files in
it and no indication of what any of them is about.

## 14. Components, not copied locators

The site header — identity menu, sign-out, cart badge — appears on every page.
`pages/components/header.component.ts` owns it, and page objects compose it
(`readonly header = new HeaderComponent(page)`) rather than inherit it: a page HAS a
header, it is not a kind of header.

Before that, the identity menu lived in `AccountPage` and the cart badge in
`ProductPage`, purely because of where each was first needed. That is fine until a
second page needs the same element, at which point the options are duplicating the
locator or making one page object depend on another. Both are worse than naming the
component.

Note what did **not** move: the search box is in the header, and it stayed in
`CatalogPage`, because only the catalog uses it and the catalog owns the response it
waits for. Extracting it would be copying a pattern rather than solving a problem —
which is the same mistake as decision 5's token pool, one size down.

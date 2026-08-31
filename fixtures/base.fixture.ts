/**
 * fixtures/base.fixture.ts — custom Playwright fixtures.
 *
 * IMPORTANT: always import `test` and `expect` from this file, not from @playwright/test.
 * Everything a test needs arrives through a fixture, so no spec ever constructs a
 * page object or an API client itself.
 *
 * Page objects:  loginPage, registerPage, catalogPage, productPage, checkoutPage,
 *                favoritesPage, accountPage, profilePage
 * API clients:   authApi, productsApi, favoritesApi, usersApi
 * Identity:      runUser — credentials of the user this run registered
 * Guest access:  guest — one fresh context WITHOUT storageState, holding the login,
 *                register and account pages; the "ui" project starts every other
 *                test already authenticated
 * Auto:          _allureLabels — severity/layer/feature derived from tags
 * Overrides:     page — captures console errors, attached to the report on failure
 */
import { test as base } from '@playwright/test'

import { AuthApi } from '../api/auth.api'
import { FavoritesApi } from '../api/favorites.api'
import { ProductsApi } from '../api/products.api'
import { UsersApi } from '../api/users.api'
import { readRunUser, RunUser } from '../core/run-user'
import { AccountPage } from '../pages/account/account.page'
import { FavoritesPage } from '../pages/account/favorites.page'
import { ProfilePage } from '../pages/account/profile.page'
import { LoginPage } from '../pages/auth/login.page'
import { RegisterPage } from '../pages/auth/register.page'
import { CatalogPage } from '../pages/shop/catalog.page'
import { CheckoutPage } from '../pages/shop/checkout.page'
import { ProductPage } from '../pages/shop/product.page'
import { applyAllureLabels } from '../core/allure-labels'

/** Page objects that all share one logged-out browser context. */
export interface GuestSession {
	loginPage: LoginPage
	registerPage: RegisterPage
	accountPage: AccountPage
}

type TestFixtures = {
	loginPage: LoginPage
	registerPage: RegisterPage
	catalogPage: CatalogPage
	productPage: ProductPage
	checkoutPage: CheckoutPage
	favoritesPage: FavoritesPage
	accountPage: AccountPage
	profilePage: ProfilePage
	guest: GuestSession
	authApi: AuthApi
	productsApi: ProductsApi
	favoritesApi: FavoritesApi
	usersApi: UsersApi
	runUser: RunUser
	_allureLabels: void
}

export const test = base.extend<TestFixtures>({
	// ── Page objects (authenticated context from storageState) ──────────────────

	loginPage: async ({ page }, use) => {
		await use(new LoginPage(page))
	},

	registerPage: async ({ page }, use) => {
		await use(new RegisterPage(page))
	},

	catalogPage: async ({ page }, use) => {
		await use(new CatalogPage(page))
	},

	productPage: async ({ page }, use) => {
		await use(new ProductPage(page))
	},

	checkoutPage: async ({ page }, use) => {
		await use(new CheckoutPage(page))
	},

	favoritesPage: async ({ page }, use) => {
		await use(new FavoritesPage(page))
	},

	accountPage: async ({ page }, use) => {
		await use(new AccountPage(page))
	},

	profilePage: async ({ page }, use) => {
		await use(new ProfilePage(page))
	},

	/**
	 * A FRESH, logged-out browser context with every page object bound to it.
	 *
	 * The "ui" project loads the run user's storageState by default, so login and
	 * registration scenarios — which are about becoming authenticated — must start
	 * from an empty session.
	 *
	 * All three page objects deliberately share ONE context. The earlier version of
	 * this fixture handed out only a guest LoginPage, and tests reached for the
	 * regular `accountPage` afterwards to check who was signed in. That page lives in
	 * a different browser context: the assertion ran against a browser that never
	 * saw the login. It failed loudly here, which was lucky — the same mistake in the
	 * other direction gives you a test that passes for the wrong reason forever.
	 */
	guest: async ({ browser }, use) => {
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
		const page = await context.newPage()
		await use({
			loginPage: new LoginPage(page),
			registerPage: new RegisterPage(page),
			accountPage: new AccountPage(page),
		})
		await context.close()
	},

	// ── API clients ─────────────────────────────────────────────────────────────

	authApi: async ({}, use) => {
		await use(new AuthApi())
	},

	productsApi: async ({}, use) => {
		await use(new ProductsApi())
	},

	favoritesApi: async ({}, use) => {
		await use(new FavoritesApi())
	},

	usersApi: async ({}, use) => {
		await use(new UsersApi())
	},

	// ── Identity ────────────────────────────────────────────────────────────────

	/** The account this run owns. Read from disk — written by global-setup. */
	runUser: async ({}, use) => {
		await use(readRunUser())
	},

	// ── Auto fixture: report metadata ───────────────────────────────────────────

	/**
	 * Severity, layer, feature and owner, derived from the tags and describe title
	 * the test already declares. Runs for every test, including API ones — which is
	 * why it does not depend on `page`.
	 */
	_allureLabels: [
		async ({}, use, testInfo) => {
			await applyAllureLabels(testInfo)
			await use()
		},
		{ auto: true, scope: 'test' },
	],

	// ── Browser console capture ─────────────────────────────────────────────────

	/**
	 * Overrides the built-in `page` to record console errors and page exceptions,
	 * attaching them to the report only when the test fails.
	 *
	 * This started life as an `auto: true` fixture that depended on `page`. That
	 * quietly launched a browser for all 21 API tests, which need no browser at all —
	 * the suite was paying for it on every run and nothing in the output said so.
	 * As an override it is lazy: only tests that actually touch a page create one.
	 *
	 * A JS exception in the console is often the real reason a locator "timed out".
	 * Attaching it turns a five-minute trace hunt into reading two lines.
	 */
	page: async ({ page }, use, testInfo) => {
		const logs: string[] = []
		page.on('console', (msg) => {
			if (['warning', 'error'].includes(msg.type())) {
				logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`)
			}
		})
		page.on('pageerror', (error) => {
			logs.push(`[PAGE ERROR] ${error.message}`)
		})

		await use(page)

		if (testInfo.status !== testInfo.expectedStatus && logs.length > 0) {
			await testInfo.attach('browser-console', { body: logs.join('\n'), contentType: 'text/plain' })
		}
	},
})

export { expect } from '@playwright/test'

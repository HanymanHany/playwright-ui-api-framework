/**
 * core/global-setup.ts — runs ONCE before all tests, in this order:
 *
 * 1. Register the run user via API (~300ms). Everything the suite does afterwards
 *    happens as this user, so no worker can collide with another worker or with
 *    whoever else is poking at the public demo right now. See core/run-user.ts.
 *
 * 2. Log that user in through the UI once and save the browser session to
 *    `.auth/run-user-state.json`. Every "ui" test starts authenticated via
 *    storageState — no login step repeated in every test (~5s saved per test,
 *    and one fewer thing that can flake).
 *
 * 3. Build the API data snapshot: category tree, brands, first page of products,
 *    fetched once into `.auth/data-snapshot.json`. Spec files read it synchronously
 *    in beforeAll instead of every worker hammering the same endpoints.
 *
 * Reference data is snapshotted. Mutable state (favorites, cart) is never
 * snapshotted — tests create it live, because a snapshot of state that changes
 * is just a stale assertion waiting to happen.
 *
 * If any step throws, the whole run stops here. That is deliberate: a suite that
 * starts without a valid user produces 30 identical 401s and no information.
 */
import * as fs from 'fs'

import { chromium } from '@playwright/test'

import { ProductsApi } from '../api/products.api'
import { UsersApi } from '../api/users.api'
import { AUTH_STATE_FILE, HEADLESS, OPENAPI_SPEC_FILE, OPENAPI_URL, RUN_ID, UI_BASE_URL } from '../config/env'
import { routes } from '../data/routes.data'
import { LoginPage } from '../pages/auth/login.page'
import { REQUIRED_PRODUCTS, writeDataSnapshot } from '../utils/data-snapshot'
import { createLogger } from '../utils/logger'

import { writeAllureCategories } from './allure-categories'
import { buildRunUser, saveRunUser } from './run-user'

const log = createLogger('GlobalSetup')

async function registerRunUser(): Promise<{ email: string; password: string }> {
	const payload = buildRunUser()
	const created = await new UsersApi().register(payload)

	saveRunUser({
		id: created.id,
		email: payload.email,
		password: payload.password,
		firstName: payload.first_name,
		lastName: payload.last_name,
		registeredAt: new Date().toISOString(),
	})

	log.setup(`Run user registered: ${payload.email} (id ${created.id})`)
	return { email: payload.email, password: payload.password }
}

async function loginAndSaveState(credentials: { email: string; password: string }): Promise<void> {
	const browser = await chromium.launch({ headless: HEADLESS })
	try {
		const context = await browser.newContext({ locale: 'en-US' })
		const page = await context.newPage()

		await page.goto(UI_BASE_URL + routes.login, { waitUntil: 'domcontentloaded' })

		// LoginPage is the single source of login logic — no duplicated selectors here
		const loginPage = new LoginPage(page)
		await loginPage.login(credentials.email, credentials.password)
		await loginPage.assertLoginSucceeded()

		fs.mkdirSync('.auth', { recursive: true })
		await context.storageState({ path: AUTH_STATE_FILE })
		log.setup(`Auth state saved → ${AUTH_STATE_FILE}`)
	} finally {
		await browser.close()
	}
}

/**
 * Two pages, not one. Page 1 alone yields 8 in-stock products and the suite reserves
 * 7 of them (see PRODUCT_ALLOCATIONS) — one spare is not a margin, it is a countdown.
 * Fetching a second page costs ~200ms and removes the whole class of "the demo was
 * reseeded and now there is one product fewer" failures.
 */
const SNAPSHOT_PAGES = 2

async function buildDataSnapshot(): Promise<void> {
	const productsApi = new ProductsApi()
	const [categories, brands, ...pages] = await Promise.all([
		productsApi.getCategoryTree(),
		productsApi.getBrands(),
		...Array.from({ length: SNAPSHOT_PAGES }, (_, i) => productsApi.getProducts(i + 1)),
	])

	const products = pages.flatMap((page) => page.data)
	const inStock = products.filter((p) => p.in_stock).length

	if (inStock < REQUIRED_PRODUCTS) {
		throw new Error(
			`Snapshot has ${inStock} in-stock products, the suite needs ${REQUIRED_PRODUCTS}. ` +
				`Increase SNAPSHOT_PAGES or check the target environment.`
		)
	}

	writeDataSnapshot({ builtAt: new Date().toISOString(), categories, brands, products })
	log.setup(
		`Data snapshot saved: ${categories.length} category roots, ${brands.length} brands, ` +
			`${products.length} products (${inStock} in stock, ${REQUIRED_PRODUCTS} required)`
	)
}

/**
 * Downloads the OpenAPI document the contract tests validate against.
 * Fetched once, here, so that every worker checks live responses against the
 * SAME document — otherwise a deploy mid-run makes half the suite disagree.
 */
async function downloadOpenApiSpec(): Promise<void> {
	const response = await fetch(OPENAPI_URL, { headers: { Accept: 'application/json' } })
	if (!response.ok) {
		throw new Error(`Could not download OpenAPI spec from ${OPENAPI_URL}: HTTP ${response.status}`)
	}
	const spec = (await response.json()) as { info?: { version?: string }; paths?: object }
	fs.writeFileSync(OPENAPI_SPEC_FILE, JSON.stringify(spec))
	log.setup(`OpenAPI spec saved: v${spec.info?.version}, ${Object.keys(spec.paths ?? {}).length} paths`)
}

export default async function globalSetup(): Promise<void> {
	const startedAt = Date.now()
	log.setup(`Run ${RUN_ID} → ${UI_BASE_URL}`)

	fs.mkdirSync('.auth', { recursive: true })
	writeAllureCategories()

	const credentials = await registerRunUser()
	await Promise.all([loginAndSaveState(credentials), buildDataSnapshot(), downloadOpenApiSpec()])

	log.setup(`Ready in ${Date.now() - startedAt}ms`)
}

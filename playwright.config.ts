/**
 * playwright.config.ts — main Playwright configuration.
 *
 * PARALLELISM
 *
 * `fullyParallel: true` — every test is independent and can run in its own worker.
 * That is only defensible because of what global-setup does: the suite registers
 * its own user, so there is no shared mutable state for workers to fight over.
 * Turning this flag on without that isolation is how you buy a flaky suite that
 * passes locally and fails in CI once a week.
 *
 * The order is deliberate: isolate the data first, parallelise second. Doing it the
 * other way round produces failures that look like timing bugs and are not.
 *
 * PROJECTS
 *   "api" — API-only tests: no browser, no storageState
 *   "ui"  — UI + hybrid tests: start authenticated as the run user
 *
 * RETRIES
 *
 * Zero, on purpose. A retry converts a real race into a green build and postpones
 * the diagnosis until the day it matters. If a test needs a retry to pass, it is
 * telling you something about isolation that is worth listening to.
 *
 * THE @demo TESTS
 *
 * The suite ships three tests that fail on purpose — they exist so the Allure report
 * has something red to show: a screenshot attached to a failed UI test, and the way an
 * API assertion prints expected against actual. Documentation of what a failure looks
 * like is worth more than a paragraph describing it.
 *
 * They run in the normal local suite, so `npm test` is red by design: 34 passed,
 * 3 failed. CI excludes them, because there a red run means "this suite is broken",
 * and a badge cannot explain the difference. `npm run test:demo` runs only those three.
 */
import { defineConfig } from '@playwright/test'

import { AUTH_STATE_FILE, HEADLESS, UI_BASE_URL, WORKERS } from './config/env'
import { ASSERTION_TIMEOUT, TEST_TIMEOUT } from './config/timeouts'

export default defineConfig({
	testDir: './tests',

	timeout: TEST_TIMEOUT,
	expect: { timeout: ASSERTION_TIMEOUT },

	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: WORKERS,

	// The @demo tests fail on purpose. They run locally — that is the point of them —
	// and are excluded in CI, where a red badge would report a broken suite rather than
	// a documented one.
	grepInvert: process.env.CI ? /@demo/ : undefined,

	reporter: [
		['list'],
		['html', { open: 'never' }],
		[
			'allure-playwright',
			{
				detail: true,
				outputFolder: 'allure-results',
				suiteTitle: false,
				cleanResultsDir: !process.env.CI,
				environmentInfo: {
					UI: UI_BASE_URL,
					Workers: String(WORKERS),
					Node: process.version,
					CI: process.env.CI ? 'yes' : 'no',
				},
			},
		],
		...(process.env.CI ? [['github'] as [string]] : []),
	],

	globalSetup: require.resolve('./core/global-setup'),
	globalTeardown: require.resolve('./core/global-teardown'),

	use: {
		baseURL: UI_BASE_URL,
		headless: HEADLESS,
		locale: 'en-US',
		viewport: { width: 1440, height: 900 },
		screenshot: 'only-on-failure',
		video: 'off',
		trace: 'retain-on-failure',
	},

	projects: [
		// Specs are grouped by feature (tests/auth, tests/catalog, ...) and the LAYER
		// lives in the filename suffix. Projects match the suffix rather than the
		// folder, so a feature keeps its API, UI and hybrid tests side by side while
		// the api project still launches no browser at all.
		{
			name: 'api',
			testMatch: /.*\.api\.spec\.ts/,
		},
		{
			name: 'ui',
			testMatch: /.*\.(ui|hybrid)\.spec\.ts/,
			use: {
				storageState: AUTH_STATE_FILE,
			},
		},
	],
})

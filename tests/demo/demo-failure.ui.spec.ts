/**
 * tests/ui/demo-failure.spec.ts — a UI test that fails ON PURPOSE.
 *
 * Companion to tests/api/demo-failure.spec.ts. That one shows what an API failure
 * reads like; this one shows what the browser leaves behind: a screenshot of the page
 * as it actually was, a trace you can step through, and the captured browser console.
 *
 * Tagged `@demo`, excluded from normal runs, run with `npm run test:demo`.
 *
 * The failure sits in the LAST step deliberately. The report then shows three green
 * steps and one red one, which is the useful shape: it tells you the login worked, the
 * navigation worked, and only the final claim was wrong. A test that fails on its first
 * line tells you almost nothing.
 *
 * `screenshot: 'only-on-failure'` and `trace: 'retain-on-failure'` come from
 * playwright.config.ts — nothing is attached by hand here. Note where the screenshot
 * ends up in the report: on the TEST, not inside the failed step. Playwright takes it
 * after the test ends, when that step is already closed.
 */
import { test } from '../../fixtures/base.fixture'

test.describe('[UI / Demo failures]', () => {
	test(
		'DEMO FAIL: the header is asserted to greet the wrong name',
		{ tag: ['@demo', '@ui'] },
		async ({ guest, runUser }) => {
			await test.step('Prepare: open the login page as a guest', async () => {
				await guest.loginPage.goto()
				await guest.loginPage.assertPageLoaded()
			})

			await test.step('Action: sign in with the run user credentials', async () => {
				await guest.loginPage.login(runUser.email, runUser.password)
			})

			await test.step('Verify: landed on the account page', async () => {
				await guest.accountPage.assertOnAccountPage()
			})

			await test.step('Verify: header greets "Nobody Expects This" (it does not — fails on purpose)', async () => {
				await guest.accountPage.assertSignedInAs('Nobody Expects This')
			})
		}
	)
})

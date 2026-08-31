/**
 * tests/ui/login.spec.ts — UI login and sign-out.
 *
 * These use the `guest` fixture (fresh context, empty storageState), because the
 * "ui" project starts every test already authenticated. Logging in is the thing
 * under test, so it cannot start from a logged-in state.
 *
 * The success assertion checks the header greets the run user BY NAME. "We landed
 * on /account" only proves a redirect happened; the name proves the session belongs
 * to the user we just logged in as — which is the actual claim being made.
 */
import { test } from '../../fixtures/base.fixture'

test.describe('[UI / Auth / Login]', () => {
	test('valid credentials land on My account as that user', { tag: ['@ui', '@smoke'] }, async ({ guest, runUser }) => {
		await test.step('Prepare: open the login page as a guest', async () => {
			await guest.loginPage.goto()
			await guest.loginPage.assertPageLoaded()
		})

		await test.step('Action: submit the run user credentials', async () => {
			await guest.loginPage.login(runUser.email, runUser.password)
		})

		await test.step('Verify: redirected to /account and greeted by name', async () => {
			await guest.loginPage.assertLoginSucceeded()
			await guest.accountPage.assertSignedInAs(`${runUser.firstName} ${runUser.lastName}`)
		})
	})

	test(
		'wrong password shows an error and stays on login',
		{ tag: ['@ui', '@negative'] },
		async ({ guest, runUser }) => {
			await test.step('Prepare: open the login page as a guest', async () => {
				await guest.loginPage.goto()
			})

			await test.step('Action: submit a wrong password', async () => {
				await guest.loginPage.login(runUser.email, 'definitely-wrong-password')
			})

			await test.step('Verify: error message shown, still on /auth/login', async () => {
				await guest.loginPage.assertLoginErrorVisible()
				await guest.loginPage.assertStillOnLoginPage()
			})
		}
	)

	test('signing out returns to the login page', { tag: ['@ui', '@regression'] }, async ({ accountPage }) => {
		await test.step('Prepare: open the account page (already authenticated)', async () => {
			await accountPage.goto()
			await accountPage.assertOnAccountPage()
		})

		await test.step('Action: sign out from the header menu', async () => {
			await accountPage.signOut()
		})

		await test.step('Verify: back on the login page', async () => {
			await accountPage.assertSignedOut()
		})
	})
})

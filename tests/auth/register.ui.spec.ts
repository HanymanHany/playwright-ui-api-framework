/**
 * tests/ui/register.spec.ts — the registration form.
 *
 * The API-level rules already have their own tests (tests/api/registration.spec.ts).
 * What these add is the part only a browser can answer: does the form send the right
 * payload, and does it show the user what went wrong when the server says no.
 *
 * The happy-path test does not stop at "we got redirected". It logs the new account
 * in afterwards, because a form that redirects on a failed POST is a real bug class
 * and a redirect-only assertion sails straight past it.
 *
 * Account data comes from `data/test-user.data.ts`, the same source the API specs and
 * global-setup use — one definition of "a valid account", three consumers.
 */
import { UsersApi } from '../../api/users.api'
import { BREACHED_PASSWORD, buildRegistrationForm } from '../../data/test-user.data'
import { test, expect } from '../../fixtures/base.fixture'

const createdUserIds: string[] = []

test.afterAll(async () => {
	const api = new UsersApi()
	for (const id of createdUserIds) {
		await api.deleteAsAdmin(id).catch(() => {})
	}
})

test.describe('[UI / Auth / Registration]', () => {
	test(
		'a user registered through the form can sign in',
		{ tag: ['@ui', '@regression'] },
		async ({ guest, authApi, usersApi }) => {
			const account = buildRegistrationForm('ui-reg-happy')

			await test.step('Prepare: open the registration form', async () => {
				await guest.registerPage.goto()
				await guest.registerPage.assertPageLoaded()
			})

			const status = await test.step('Action: fill every field and submit', async () => {
				await guest.registerPage.fillForm(account)
				return guest.registerPage.submit()
			})

			await test.step('Verify (network): the form really reached the API and got 201', async () => {
				expect(status, 'a null status means the form blocked the submit client-side').toBe(201)
			})

			await test.step('Verify (UI): the form sends us to the login page', async () => {
				await guest.registerPage.assertRegistrationSucceeded()
			})

			await test.step('Verify (behaviour): the new credentials actually work', async () => {
				await guest.loginPage.login(account.email, account.password)
				await guest.loginPage.assertLoginSucceeded()
				await guest.accountPage.assertSignedInAs(`${account.firstName} ${account.lastName}`)
			})

			await test.step('Cleanup: record the id so afterAll can remove the account', async () => {
				const token = await authApi.login(account.email, account.password)
				const profile = await usersApi.meAs(token)
				createdUserIds.push(profile.id)
			})
		}
	)

	test(
		'a breached password is refused with a visible message',
		{ tag: ['@ui', '@negative', '@security'] },
		async ({ guest }) => {
			const account = buildRegistrationForm('ui-reg-breached', { password: BREACHED_PASSWORD })

			await test.step('Prepare: open the registration form', async () => {
				await guest.registerPage.goto()
				await guest.registerPage.assertPageLoaded()
			})

			const status = await test.step('Action: submit with a password from a known leak', async () => {
				await guest.registerPage.fillForm(account)
				return guest.registerPage.submit()
			})

			await test.step('Verify: the SERVER rejected it — this check is not client-side', async () => {
				expect(status).toBe(422)
			})

			await test.step('Verify: we stay on the form and the reason is shown to the user', async () => {
				await guest.registerPage.assertStillOnRegisterPage()
				await guest.registerPage.assertValidationErrorContains('data leak')
			})
		}
	)
})

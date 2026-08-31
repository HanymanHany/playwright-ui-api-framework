/**
 * tests/hybrid/profile.spec.ts — edit in the UI, verify through the API.
 *
 * The tempting assertion here is the green success toast. It is also the weak one:
 * a toast proves the frontend rendered a toast. It does not prove the change was
 * persisted, and "the UI says saved but the backend rejected it" is a bug that
 * ships regularly.
 *
 * So the UI does the editing — that is the thing under test — and GET /users/me
 * answers whether it actually happened.
 *
 * ISOLATION NOTE: this test mutates the run user's profile while other tests read
 * it in parallel. It only touches `phone` and `city`; the tests that assert on the
 * profile check `id` and `email`, which nothing here changes. That is not luck —
 * it is the reason those assertions were chosen.
 */
import { RUN_ID } from '../../config/env'
import { test, expect } from '../../fixtures/base.fixture'

test.describe('[Hybrid / Profile]', () => {
	test(
		'a profile edited in the UI is persisted in the API',
		{ tag: ['@hybrid', '@regression'] },
		async ({ profilePage, usersApi, runUser }) => {
			const changes = { phone: '0311234567', city: `Delft-${RUN_ID.slice(-4)}` }

			await test.step('Prepare: open the profile page (already authenticated)', async () => {
				await profilePage.goto()
				await profilePage.assertOnProfilePage()
			})

			await test.step('Verify: the form is prefilled with OUR user', async () => {
				await profilePage.assertPrefilledWith({
					firstName: runUser.firstName,
					lastName: runUser.lastName,
					email: runUser.email,
				})
			})

			const status = await test.step('Action: change phone and city, submit', async () => {
				return profilePage.updateContactDetails(changes)
			})

			await test.step('Verify (UI): the request was accepted', async () => {
				expect(status, 'PUT /users/{id} should succeed').toBeLessThan(400)
			})

			await test.step('Verify (API): GET /users/me returns the new values', async () => {
				const profile = await usersApi.me()
				expect(profile.phone).toBe(changes.phone)
				expect(profile.address?.city).toBe(changes.city)
			})
		}
	)
})

/**
 * tests/api/registration.spec.ts — the registration endpoint.
 *
 * Worth its own file because registration is what the whole isolation strategy rests
 * on: if `POST /users/register` changes its rules, global-setup stops working and
 * every other test in the suite fails for a reason that has nothing to do with what
 * it was testing. These tests fail first, and say why.
 *
 * Payloads and the API's validation rules come from `data/test-user.data.ts` — the
 * rules are encoded there once, not restated in each assertion.
 *
 * Every account created here is namespaced with RUN_ID and removed in afterAll.
 */
import { UsersApi } from '../../api/users.api'
import { BREACHED_PASSWORD, buildApiUser } from '../../data/test-user.data'
import { test, expect } from '../../fixtures/base.fixture'

/**
 * Cleaned up as admin — a user cannot delete itself (403). The array is module-level
 * and workers are separate processes, so each worker removes exactly what it created.
 */
const createdUserIds: string[] = []

test.afterAll(async () => {
	const api = new UsersApi()
	for (const id of createdUserIds) {
		await api.deleteAsAdmin(id).catch(() => {})
	}
})

test.describe('[API / Registration]', () => {
	test('a new account is created and can log in', { tag: ['@api', '@smoke'] }, async ({ usersApi, authApi }) => {
		const account = buildApiUser('reg-happy')

		const created = await test.step('Action: POST /users/register', async () => {
			const user = await usersApi.register(account)
			createdUserIds.push(user.id)
			return user
		})

		await test.step('Verify: the response echoes the account with a generated id', async () => {
			expect(created.id).toBeTruthy()
			expect(created.email).toBe(account.email)
		})

		await test.step('Verify: the credentials actually work — being created is not enough', async () => {
			const token = await authApi.login(account.email, account.password)
			expect(token.split('.')).toHaveLength(3)
		})
	})

	test('registering the same email twice is rejected', { tag: ['@api', '@negative'] }, async ({ usersApi }) => {
		const account = buildApiUser('reg-duplicate')

		await test.step('Prepare: register the account once', async () => {
			const first = await usersApi.registerRaw(account)
			expect(first.status, 'Setup: first registration must succeed').toBe(201)
			createdUserIds.push((first.body as { id: string }).id)
		})

		const second = await test.step('Action: register the same email again', async () => {
			return usersApi.registerRaw(account)
		})

		await test.step('Verify: rejected as a client error, not a 500 and not a second row', async () => {
			expect(second.status).toBeGreaterThanOrEqual(400)
			expect(second.status).toBeLessThan(500)
		})
	})

	test('a breached password is rejected', { tag: ['@api', '@negative', '@security'] }, async ({ usersApi }) => {
		const response = await test.step('Action: register with a password from a known leak', async () => {
			return usersApi.registerRaw(buildApiUser('reg-breached', { password: BREACHED_PASSWORD }))
		})

		await test.step('Verify: 422 and the message names the password field', async () => {
			expect(response.status).toBe(422)
			expect(JSON.stringify(response.body).toLowerCase()).toContain('password')
		})
	})

	test('a date of birth under 18 is rejected', { tag: ['@api', '@negative'] }, async ({ usersApi }) => {
		const underage = new Date()
		underage.setFullYear(underage.getFullYear() - 10)
		const dob = underage.toISOString().slice(0, 10)

		const response = await test.step(`Action: register with dob ${dob}`, async () => {
			return usersApi.registerRaw(buildApiUser('reg-underage', { dob }))
		})

		await test.step('Verify: 422 and the message names the dob field', async () => {
			expect(response.status).toBe(422)
			expect(JSON.stringify(response.body).toLowerCase()).toContain('dob')
		})
	})
})

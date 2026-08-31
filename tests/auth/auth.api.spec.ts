/**
 * tests/api/auth.spec.ts — authentication API tests. No browser — pure API project.
 *
 * The token-lifetime assertion is not decoration. The 300-second TTL is the single
 * most expensive fact about this API, and `api/auth.api.ts` is built around it.
 * If the backend ever changes it, this test fails first and names the reason —
 * instead of the suite going randomly red once it grows past five minutes.
 */
import { test, expect } from '../../fixtures/base.fixture'

interface JwtPayload {
	role: string
	iat: number
	exp: number
}

function decodePayload(token: string): JwtPayload {
	const segment = token.split('.')[1]
	expect(segment, 'JWT must have a payload segment').toBeDefined()
	return JSON.parse(Buffer.from(segment!, 'base64url').toString()) as JwtPayload
}

test.describe('[API / Auth]', () => {
	test('login with valid credentials returns a JWT', { tag: ['@api', '@smoke'] }, async ({ authApi, runUser }) => {
		const token = await test.step('Action: POST /users/login as the run user', async () => {
			return authApi.login(runUser.email, runUser.password)
		})

		await test.step('Verify: response is a three-part JWT', async () => {
			expect(token.split('.'), 'JWT must have header.payload.signature').toHaveLength(3)
		})

		await test.step('Verify: payload carries the customer role', async () => {
			expect(decodePayload(token).role).toBe('user')
		})
	})

	test('the issued token lives exactly 300 seconds', { tag: ['@api', '@regression'] }, async ({ authApi, runUser }) => {
		const token = await test.step('Action: log in and decode the payload', async () => {
			return authApi.login(runUser.email, runUser.password)
		})

		await test.step('Verify: exp - iat is 300s — the value getToken() refreshes against', async () => {
			const { exp, iat } = decodePayload(token)
			expect(exp - iat, 'token TTL drives TOKEN_REFRESH_AFTER_MS in api/auth.api.ts').toBe(300)
		})
	})

	test('login with wrong password returns 401', { tag: ['@api', '@negative'] }, async ({ authApi, runUser }) => {
		const response = await test.step('Action: POST /users/login with a wrong password', async () => {
			return authApi.loginRaw(runUser.email, 'definitely-wrong-password')
		})

		await test.step('Verify: 401 and no token leaked in the body', async () => {
			expect(response.status).toBe(401)
			expect(JSON.stringify(response.body)).not.toContain('access_token')
		})
	})

	test('login with an unknown email returns 401', { tag: ['@api', '@negative'] }, async ({ authApi }) => {
		const response = await test.step('Action: POST /users/login with an unregistered email', async () => {
			return authApi.loginRaw('no-such-user-000@example.com', 'Whatever!1')
		})

		await test.step('Verify: 401, with no hint that the account does not exist', async () => {
			expect(response.status).toBe(401)
			expect(JSON.stringify(response.body).toLowerCase(), 'no user-enumeration hint').not.toContain('not found')
		})
	})

	test(
		'GET /users/me returns the run user profile',
		{ tag: ['@api', '@regression'] },
		async ({ usersApi, runUser }) => {
			const profile = await test.step('Action: GET /users/me with a fresh token', async () => {
				return usersApi.me()
			})

			await test.step('Verify: it is OUR user, not the shared demo customer', async () => {
				expect(profile.email).toBe(runUser.email)
				expect(profile.id).toBe(runUser.id)
			})
		}
	)
})

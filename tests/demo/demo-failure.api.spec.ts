/**
 * tests/api/demo-failure.spec.ts — tests that fail ON PURPOSE.
 *
 * Every report screenshot in a README is green, which is the least useful state a
 * report has. These exist so the Allure report has something red to show, and so the
 * question "what does a failure actually look like here" has an answer you can click
 * instead of a paragraph describing it.
 *
 * Tagged `@demo` and excluded from every normal run by `grepInvert` in
 * playwright.config.ts — `npm test` and CI stay honestly green. Run them with
 * `npm run test:demo`.
 *
 * Two shapes of API failure, because they read very differently in a report:
 *   1. a value assertion that misses  → expected against actual, printed inline
 *   2. a status assertion that misses → the endpoint answered, just not with that
 *
 * Note what carries the meaning in both: the message passed as the second argument to
 * `expect`. It lands as the first line of the failure, so the report shows the
 * intention rather than only the numbers.
 */
import { test, expect } from '../../fixtures/base.fixture'

interface JwtPayload {
	iat: number
	exp: number
}

function decodePayload(token: string): JwtPayload {
	const segment = token.split('.')[1]
	return JSON.parse(Buffer.from(segment!, 'base64url').toString()) as JwtPayload
}

test.describe('[API / Demo failures]', () => {
	test('DEMO FAIL: token TTL is asserted as 600 seconds', { tag: ['@demo', '@api'] }, async ({ authApi, runUser }) => {
		const token = await test.step('Action: log in and decode the payload', async () => {
			return authApi.login(runUser.email, runUser.password)
		})

		await test.step('Verify: exp - iat is 600s (the real value is 300 — fails on purpose)', async () => {
			const { exp, iat } = decodePayload(token)
			expect(exp - iat, 'deliberate mismatch: this API issues 300-second tokens').toBe(600)
		})
	})

	test(
		'DEMO FAIL: a wrong password is asserted to return 200',
		{ tag: ['@demo', '@api'] },
		async ({ authApi, runUser }) => {
			const response = await test.step('Action: POST /users/login with a wrong password', async () => {
				return authApi.loginRaw(runUser.email, 'definitely-wrong-password')
			})

			await test.step('Verify: status is 200 (the API answers 401 — fails on purpose)', async () => {
				expect(response.status, 'deliberate mismatch: rejected credentials return 401').toBe(200)
			})
		}
	)
})

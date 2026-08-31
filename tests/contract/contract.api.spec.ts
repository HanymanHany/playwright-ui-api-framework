/**
 * tests/api/contract.spec.ts — does the live API still match its own OpenAPI spec?
 *
 * These are the tests that would have saved me an afternoon on a real project.
 *
 * A normal API test asserts a status code and a couple of fields it happens to care
 * about. It stays green when the backend renames a field the mobile client depends
 * on, or starts sending `null` where the spec promises a string, or quietly drops an
 * endpoint. The suite says "all good" and the first person to find out is a user.
 *
 * Contract tests close that gap from two directions:
 *   - responses are validated against the schema the API itself publishes
 *   - the operations this framework calls are checked to still exist in the spec
 *
 * Neither of these is something you think to ask an AI for. You ask for them because
 * you have been on the other end of a silent contract change.
 */
import { test, expect } from '../../fixtures/base.fixture'
import { readSpec, validateResponse } from '../../api/contract'

/**
 * Every operation the API clients in `api/` actually call.
 *
 * The path templates must match the spec exactly. That is not pedantry — the very
 * first run of this test failed on `/products/{id}` because the spec calls it
 * `/products/{productId}`. A harmless difference, until you try to look an
 * operation up by name and silently find nothing.
 */
const USED_OPERATIONS: Array<{ path: string; method: string }> = [
	{ path: '/products', method: 'get' },
	{ path: '/products/{productId}', method: 'get' },
	{ path: '/products/search', method: 'get' },
	{ path: '/categories/tree', method: 'get' },
	{ path: '/brands', method: 'get' },
	{ path: '/users/login', method: 'post' },
	{ path: '/users/register', method: 'post' },
	{ path: '/users/me', method: 'get' },
	{ path: '/users/{userId}', method: 'put' },
	{ path: '/users/{userId}', method: 'delete' },
	{ path: '/favorites', method: 'get' },
	{ path: '/favorites', method: 'post' },
	{ path: '/favorites/{favoriteId}', method: 'delete' },
]

test.describe('[API / Contract]', () => {
	test(
		'every operation the framework calls still exists in the spec',
		{ tag: ['@api', '@contract', '@smoke'] },
		async () => {
			const spec = await test.step('Prepare: read the spec downloaded in global-setup', async () => {
				return readSpec()
			})

			await test.step('Verify: no operation the clients depend on has disappeared', async () => {
				for (const { path, method } of USED_OPERATIONS) {
					const operation = spec.paths[path]?.[method]
					expect
						.soft(operation, `${method.toUpperCase()} ${path} is called by api/ but missing from the spec`)
						.toBeDefined()
				}
			})
		}
	)

	test('GET /products conforms to its documented schema', { tag: ['@api', '@contract'] }, async ({ productsApi }) => {
		const page = await test.step('Action: GET /products', async () => {
			return productsApi.getProducts(1)
		})

		await test.step('Verify: the whole paginated envelope validates', async () => {
			const result = validateResponse('/products', 'get', '200', page)
			expect(result.valid, `Response violates the spec:\n${result.errors.join('\n')}`).toBe(true)
		})
	})

	test(
		'GET /categories/tree conforms to its documented schema',
		{ tag: ['@api', '@contract'] },
		async ({ productsApi }) => {
			const tree = await test.step('Action: GET /categories/tree', async () => {
				return productsApi.getCategoryTree()
			})

			await test.step('Verify: the category tree validates', async () => {
				const result = validateResponse('/categories/tree', 'get', '200', tree)
				expect(result.valid, `Response violates the spec:\n${result.errors.join('\n')}`).toBe(true)
			})
		}
	)

	test('GET /users/me conforms to its documented schema', { tag: ['@api', '@contract'] }, async ({ usersApi }) => {
		const profile = await test.step('Action: GET /users/me as the run user', async () => {
			return usersApi.me()
		})

		await test.step('Verify: the user object validates', async () => {
			const result = validateResponse('/users/me', 'get', '200', profile)
			expect(result.valid, `Response violates the spec:\n${result.errors.join('\n')}`).toBe(true)
		})
	})
})

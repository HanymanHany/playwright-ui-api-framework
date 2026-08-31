/**
 * tests/api/products.spec.ts — catalog API behaviour.
 *
 * Structural checks live in contract.spec.ts (does the response match the spec).
 * This file checks BEHAVIOUR: does filtering actually filter, does search actually
 * search. Two different questions that are worth keeping in two different files —
 * when the suite goes red you want to know which of them broke.
 */
import { test, expect } from '../../fixtures/base.fixture'
import { readDataSnapshot, pickLeafCategory, pickSearchTerm, DataSnapshot } from '../../utils/data-snapshot'

let snapshot: DataSnapshot
let searchTerm: string

test.beforeAll(() => {
	snapshot = readDataSnapshot()
	// Derived from the live catalog, not typed in — see pickSearchTerm
	searchTerm = pickSearchTerm(snapshot)
})

test.describe('[API / Products]', () => {
	test('product list is paginated with a consistent envelope', { tag: ['@api', '@smoke'] }, async ({ productsApi }) => {
		const page1 = await test.step('Action: GET /products page 1', async () => {
			return productsApi.getProducts(1)
		})

		await test.step('Verify: pagination meta is self-consistent', async () => {
			expect(page1.current_page).toBe(1)
			expect(page1.total ?? 0).toBeGreaterThan(page1.per_page ?? 0)
			expect(page1.data).toHaveLength(page1.per_page ?? 0)
		})

		await test.step('Verify: every product carries the fields the UI renders', async () => {
			for (const product of page1.data) {
				expect.soft(product.id, `product "${product.name}" must have id`).toBeTruthy()
				expect.soft(typeof product.price, `product "${product.name}" price must be number`).toBe('number')
				expect.soft(product.category?.slug, `product "${product.name}" must carry a category`).toBeTruthy()
			}
		})
	})

	test('page 2 returns a different set of products', { tag: ['@api', '@regression'] }, async ({ productsApi }) => {
		const [first, second] = await test.step('Action: GET pages 1 and 2', async () => {
			return Promise.all([productsApi.getProducts(1), productsApi.getProducts(2)])
		})

		await test.step('Verify: no product appears on both pages', async () => {
			const firstIds = new Set(first.data.map((p) => p.id))
			const overlap = second.data.filter((p) => firstIds.has(p.id)).map((p) => p.name)
			expect(overlap, 'pagination must not repeat items across pages').toEqual([])
		})
	})

	test('search returns only matching products', { tag: ['@api', '@regression'] }, async ({ productsApi }) => {
		const results = await test.step(`Action: GET /products/search?q=${searchTerm}`, async () => {
			return productsApi.searchProducts(searchTerm)
		})

		await test.step('Verify: non-empty and every name matches', async () => {
			expect(results.data.length, `"${searchTerm}" is shared by 2+ catalog names`).toBeGreaterThan(1)
			for (const product of results.data) {
				expect.soft(product.name.toLowerCase(), `"${product.name}" should match "${searchTerm}"`).toContain(searchTerm)
			}
		})
	})

	test(
		'category filter returns only products of that category',
		{ tag: ['@api', '@regression'] },
		async ({ productsApi }) => {
			const leaf = pickLeafCategory(snapshot)

			const filtered = await test.step(`Action: GET /products?by_category=${leaf.id}`, async () => {
				return productsApi.getProductsByCategory(leaf.id)
			})

			await test.step('Verify: non-empty and every product belongs to the category', async () => {
				expect(filtered.data.length).toBeGreaterThan(0)
				for (const product of filtered.data) {
					expect.soft(product.category.slug, `"${product.name}" category mismatch`).toBe(leaf.slug)
				}
			})
		}
	)

	test('an unknown product id returns 404', { tag: ['@api', '@negative'] }, async ({ productsApi }) => {
		const error = await test.step('Action: GET /products/{id} with a well-formed but unused id', async () => {
			return productsApi.getProduct('01ZZZZZZZZZZZZZZZZZZZZZZZZ').catch((e: Error & { status?: number }) => e)
		})

		await test.step('Verify: 404, not 500 — an unknown id is a client error', async () => {
			expect(error).toBeInstanceOf(Error)
			expect((error as Error & { status?: number }).status).toBe(404)
		})
	})
})

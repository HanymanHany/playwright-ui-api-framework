/**
 * tests/ui/catalog.spec.ts — catalog filtering, search, and sorting.
 *
 * THE POINT OF THIS FILE: the UI is verified against API truth.
 *
 * The obvious version of the category-filter test is "check the box, assert three
 * specific product names appear". It passes, and it is nearly worthless: it breaks
 * the moment someone adds a product to that category, and it never notices if the
 * filter silently returns the wrong subset — because the expected list was written
 * by a human who was looking at the same wrong screen.
 *
 * Here the expectation comes from the API: we ask which products belong to the
 * category, then assert the grid shows exactly those. The test now checks the
 * frontend against the backend rather than against a hardcoded guess, and it keeps
 * working when the catalog changes.
 *
 * This is also the difference between a test that passes and a test that verifies.
 */
import { ProductsApi } from '../../api/products.api'
import { test } from '../../fixtures/base.fixture'
import { readDataSnapshot, pickLeafCategory, pickSearchTerm, DataSnapshot } from '../../utils/data-snapshot'

import type { CategoryNode } from '../../api/types'

let snapshot: DataSnapshot
let leafCategory: CategoryNode
let expectedCategoryProducts: string[] = []
let searchTerm: string

test.beforeAll(async () => {
	snapshot = readDataSnapshot()
	leafCategory = pickLeafCategory(snapshot)
	// Derived from the live catalog, not typed in — see pickSearchTerm
	searchTerm = pickSearchTerm(snapshot)
	// API truth: exactly which products the UI MUST show when this category is checked
	const filtered = await new ProductsApi().getProductsByCategory(leafCategory.id)
	expectedCategoryProducts = filtered.data.map((p) => p.name)
})

test.describe('[UI / Catalog]', () => {
	test(
		'category filter shows only the products the API returns',
		{ tag: ['@ui', '@smoke'] },
		async ({ catalogPage }) => {
			await test.step('Prepare: open the catalog', async () => {
				await catalogPage.goto()
				await catalogPage.assertPageLoaded()
			})

			await test.step(`Action: check the "${leafCategory.name}" category`, async () => {
				await catalogPage.filterByCategory(leafCategory.id)
			})

			await test.step('Verify: the grid matches the API subset for this category', async () => {
				await catalogPage.assertGridShowsOnly(expectedCategoryProducts, `category "${leafCategory.name}"`)
			})
		}
	)

	test('search shows only matching products', { tag: ['@ui', '@regression'] }, async ({ catalogPage }) => {
		await test.step('Prepare: open the catalog', async () => {
			await catalogPage.goto()
		})

		await test.step(`Action: search for "${searchTerm}"`, async () => {
			await catalogPage.searchFor(searchTerm)
		})

		await test.step('Verify: every visible product name matches the query', async () => {
			await catalogPage.assertEveryNameContains(searchTerm)
		})
	})

	test('sort by price ascending reorders the grid', { tag: ['@ui', '@regression'] }, async ({ catalogPage }) => {
		await test.step('Prepare: open the catalog', async () => {
			await catalogPage.goto()
			await catalogPage.assertPageLoaded()
		})

		await test.step('Action: sort by price (low to high)', async () => {
			await catalogPage.sortBy('price,asc')
		})

		await test.step('Verify: visible prices settle into ascending order', async () => {
			await catalogPage.assertPricesSortedAscending()
		})
	})
})

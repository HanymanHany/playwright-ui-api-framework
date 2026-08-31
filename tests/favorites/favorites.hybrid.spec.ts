/**
 * tests/hybrid/favorites.spec.ts — the pattern this framework exists to show.
 *
 * THE IDEA
 *
 * A pure UI test for "a favorited product shows up in my favorites" would be:
 * open the catalog, find a product, open it, click the heart, navigate to the
 * favorites page, assert the card. Eight or nine steps, ~10 seconds, and seven of
 * those steps are not what the test is about — they are setup performed by clicking.
 * When any of them breaks, this test goes red for a reason unrelated to favorites.
 *
 * The hybrid version creates the state through the API in ~200ms and spends the
 * browser only on the actual claim: does the UI render it, and does a UI action
 * propagate back. Setup that is not under test should not be done by clicking.
 *
 * That is the whole trick, and it is not a Playwright feature — it is knowing which
 * part of the scenario is the assertion and which part is scaffolding.
 */
import { test, expect } from '../../fixtures/base.fixture'
import { readDataSnapshot, productsFor, DataSnapshot } from '../../utils/data-snapshot'

import type { Product } from '../../api/types'

let snapshot: DataSnapshot
let products: Product[]

test.beforeAll(() => {
	snapshot = readDataSnapshot()
	// This file's own reserved slice — see PRODUCT_ALLOCATIONS in utils/data-snapshot.
	// With fullyParallel these two tests run at the same time as the API favorites
	// spec, and favouriting the same product twice is a 4xx, not a passing test.
	products = productsFor(snapshot, 'hybrid/favorites')
})

test.describe('[Hybrid / Favorites]', () => {
	test(
		'a favorite created via API is rendered in the UI',
		{ tag: ['@hybrid', '@smoke'] },
		async ({ favoritesApi, favoritesPage }) => {
			const product = products[0]!
			let favoriteId = ''

			await test.step('Prepare (API): add the product to favorites', async () => {
				const created = await favoritesApi.addFavorite(product.id)
				favoriteId = created.id
			})

			await test.step('Action: open the favorites page', async () => {
				await favoritesPage.goto()
				await favoritesPage.assertPageLoaded()
			})

			await test.step('Verify: that exact card is visible with the product name', async () => {
				await favoritesPage.assertFavoriteVisible(favoriteId, product.name)
			})

			await test.step('Cleanup (API): remove the favorite', async () => {
				await favoritesApi.removeFavorite(favoriteId).catch(() => {})
			})
		}
	)

	test(
		'deleting a favorite in the UI removes it from the API',
		{ tag: ['@hybrid', '@regression'] },
		async ({ favoritesApi, favoritesPage }) => {
			const product = products[1]!
			let favoriteId = ''

			await test.step('Prepare (API): add the product to favorites', async () => {
				const created = await favoritesApi.addFavorite(product.id)
				favoriteId = created.id
			})

			await test.step('Action: delete the card in the UI', async () => {
				await favoritesPage.goto()
				await favoritesPage.assertFavoriteVisible(favoriteId, product.name)
				await favoritesPage.deleteFavorite(favoriteId)
			})

			await test.step('Verify (UI): the card disappears', async () => {
				await favoritesPage.assertFavoriteGone(favoriteId)
			})

			await test.step('Verify (API): the deletion reached the backend', async () => {
				const remaining = await favoritesApi.getFavorites()
				expect(remaining.map((f) => f.id)).not.toContain(favoriteId)
			})
		}
	)
})

/**
 * tests/api/favorites.spec.ts — favorites endpoints, as the run user.
 *
 * Note what is NOT asserted anywhere here: the total number of favorites.
 * The suite runs in parallel and the hybrid tests add favorites to the same user,
 * so "the list has exactly one item" is a race dressed up as an assertion.
 * Every check below is about the entity this test created, found by id.
 *
 * Each test also takes its OWN product from the snapshot. Two tests favouriting
 * the same product would collide on the duplicate constraint — in a different
 * worker, at a different moment, roughly once every twenty runs.
 */
import { test, expect } from '../../fixtures/base.fixture'
import { readDataSnapshot, productsFor, DataSnapshot } from '../../utils/data-snapshot'

import type { Product } from '../../api/types'

let snapshot: DataSnapshot
let products: Product[]

test.beforeAll(() => {
	snapshot = readDataSnapshot()
	products = productsFor(snapshot, 'api/favorites')
})

test.describe('[API / Favorites]', () => {
	test('a favorite is created and appears in the list', { tag: ['@api', '@smoke'] }, async ({ favoritesApi }) => {
		const product = products[0]!
		let favoriteId = ''

		await test.step('Action: POST /favorites', async () => {
			const created = await favoritesApi.addFavorite(product.id)
			favoriteId = created.id
		})

		await test.step('Verify: GET /favorites contains that exact favorite with its product', async () => {
			const list = await favoritesApi.getFavorites()
			const mine = list.find((f) => f.id === favoriteId)
			expect(mine, `favorite ${favoriteId} should be in the list`).toBeDefined()
			expect(mine!.product.id).toBe(product.id)
		})

		await test.step('Cleanup: remove it', async () => {
			await favoritesApi.removeFavorite(favoriteId)
		})
	})

	test('favouriting the same product twice is rejected', { tag: ['@api', '@negative'] }, async ({ favoritesApi }) => {
		const product = products[1]!
		let favoriteId = ''

		await test.step('Prepare: favourite the product once', async () => {
			const created = await favoritesApi.addFavorite(product.id)
			favoriteId = created.id
		})

		const response = await test.step('Action: POST the same product again', async () => {
			return favoritesApi.addFavoriteRaw(product.id)
		})

		await test.step('Verify: client error, not a silent second row', async () => {
			expect(response.status).toBeGreaterThanOrEqual(400)
			expect(response.status).toBeLessThan(500)
		})

		await test.step('Cleanup: remove it', async () => {
			await favoritesApi.removeFavorite(favoriteId).catch(() => {})
		})
	})

	test('a deleted favorite is gone from the list', { tag: ['@api', '@regression'] }, async ({ favoritesApi }) => {
		const product = products[2]!
		let favoriteId = ''

		await test.step('Prepare: create a favorite', async () => {
			const created = await favoritesApi.addFavorite(product.id)
			favoriteId = created.id
		})

		await test.step('Action: DELETE /favorites/{id}', async () => {
			await favoritesApi.removeFavorite(favoriteId)
		})

		await test.step('Verify: the id is no longer returned', async () => {
			const list = await favoritesApi.getFavorites()
			expect(list.map((f) => f.id)).not.toContain(favoriteId)
		})
	})
})

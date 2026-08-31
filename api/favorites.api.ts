/**
 * api/favorites.api.ts — favorites API client (authenticated endpoints).
 *
 * Used by hybrid tests: favorites are created/removed via API (fast, reliable),
 * while the browser is only used for what we actually verify — rendering.
 *
 * All calls act as the run user, so nothing here can collide with another run.
 */
import { API_BASE_URL } from '../config/env'

import { getToken } from './auth.api'
import { bearer, createApiClient, toRaw, unwrap, type ApiClient } from './client'

import type { Favorite, FavoriteWithProduct } from './types'

export class FavoritesApi {
	private readonly client: ApiClient

	constructor(baseUrl: string = API_BASE_URL) {
		this.client = createApiClient(baseUrl)
	}

	async getFavorites(): Promise<FavoriteWithProduct[]> {
		const result = await this.client.GET('/favorites', { headers: bearer(await getToken()) })
		return unwrap(result, 'GET /favorites') as FavoriteWithProduct[]
	}

	async addFavorite(productId: string): Promise<Favorite> {
		const result = await this.client.POST('/favorites', {
			headers: bearer(await getToken()),
			body: { product_id: productId },
		})
		return unwrap(result, 'POST /favorites') as Favorite
	}

	/** Raw variant for negative tests (duplicate → 422, unknown product → 422). */
	async addFavoriteRaw(productId: string): Promise<{ status: number; body: unknown }> {
		const result = await this.client.POST('/favorites', {
			headers: bearer(await getToken()),
			body: { product_id: productId },
		})
		return toRaw(result)
	}

	async removeFavorite(favoriteId: string): Promise<void> {
		await this.client.DELETE('/favorites/{favoriteId}', {
			params: { path: { favoriteId } },
			headers: bearer(await getToken()),
		})
	}

	/**
	 * Removes every favorite of the run user — safe because the user is ours alone.
	 * Used by afterAll cleanup; tolerates entities already gone.
	 */
	async clearAll(): Promise<number> {
		const favorites = await this.getFavorites()
		for (const favorite of favorites) {
			await this.removeFavorite(favorite.id).catch(() => {})
		}
		return favorites.length
	}
}

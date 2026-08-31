/**
 * api/products.api.ts — products, categories, and brands API client.
 *
 * Paths are checked against the generated schema at compile time: `/products/{id}`
 * no longer compiles, because the spec calls it `/products/{productId}`. That exact
 * typo used to live in this file and was caught only at runtime.
 *
 * The `as` casts narrow the generated response — the spec marks almost nothing as
 * required, and `api/types.ts` documents which fields this suite relies on. The
 * narrowing is a claim; the contract tests are the proof.
 */
import { API_BASE_URL } from '../config/env'

import { createApiClient, unwrap, type ApiClient } from './client'

import type { Brand, CategoryNode, Paginated, Product } from './types'

export class ProductsApi {
	private readonly client: ApiClient

	constructor(baseUrl: string = API_BASE_URL) {
		this.client = createApiClient(baseUrl)
	}

	async getProducts(page = 1): Promise<Paginated<Product>> {
		const result = await this.client.GET('/products', { params: { query: { page } } })
		return unwrap(result, 'GET /products') as Paginated<Product>
	}

	async getProduct(id: string): Promise<Product> {
		const result = await this.client.GET('/products/{productId}', { params: { path: { productId: id } } })
		return unwrap(result, 'GET /products/{productId}') as Product
	}

	/** Full-text product search. Public endpoint, no auth needed. */
	async searchProducts(query: string): Promise<Paginated<Product>> {
		const result = await this.client.GET('/products/search', { params: { query: { q: query } } })
		return unwrap(result, 'GET /products/search') as Paginated<Product>
	}

	/**
	 * Products in a category, by category ID — the same ids the UI checkboxes carry
	 * as `[data-test="category-{categoryId}"]`.
	 *
	 * This used to call an undocumented `by_category_slug` parameter. It worked, and
	 * it was invisible to the contract test, because a parameter that is not in the
	 * spec cannot drift from the spec — it can only disappear one day without notice.
	 * The typed client refused to compile it, which is how it was found.
	 */
	async getProductsByCategory(categoryId: string): Promise<Paginated<Product>> {
		const result = await this.client.GET('/products', { params: { query: { by_category: categoryId } } })
		return unwrap(result, 'GET /products?by_category') as Paginated<Product>
	}

	async getCategoryTree(): Promise<CategoryNode[]> {
		const result = await this.client.GET('/categories/tree', {})
		return unwrap(result, 'GET /categories/tree') as CategoryNode[]
	}

	async getBrands(): Promise<Brand[]> {
		const result = await this.client.GET('/brands', {})
		return unwrap(result, 'GET /brands') as Brand[]
	}
}

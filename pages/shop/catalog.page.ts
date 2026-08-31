/**
 * pages/shop/catalog.page.ts — home page catalog: grid, filters, search, sort.
 * Locators verified against live DOM — see docs/context/catalog/context.md
 *
 * Category/brand checkboxes use API ids in data-test (`category-{id}`) —
 * tests resolve ids from the data snapshot, never hardcode them.
 */
import { Page, Locator, expect } from '@playwright/test'

import { ASSERTION_TIMEOUT } from '../../config/timeouts'
import { routes } from '../../data/routes.data'
import { createLogger } from '../../utils/logger'
import { BasePage } from '../base.page'

export class CatalogPage extends BasePage {
	private readonly log = createLogger('CatalogPage')

	constructor(page: Page) {
		super(page)
	}

	// ── Locators ────────────────────────────────────────────────────────────────

	private get searchInput(): Locator {
		return this.page.locator('[data-test="search-query"]')
	}

	private get searchSubmitButton(): Locator {
		return this.page.locator('[data-test="search-submit"]')
	}

	private get sortSelect(): Locator {
		return this.page.locator('[data-test="sort"]')
	}

	private get productCards(): Locator {
		return this.page.locator('[data-test^="product-"]')
	}

	private get productNames(): Locator {
		return this.productCards.locator('[data-test="product-name"]')
	}

	private get productPrices(): Locator {
		return this.productCards.locator('[data-test="product-price"]')
	}

	private categoryCheckbox(categoryId: string): Locator {
		return this.page.locator(`[data-test="category-${categoryId}"]`)
	}

	private productCard(productId: string): Locator {
		return this.page.locator(`[data-test="product-${productId}"]`)
	}

	// ── Actions ─────────────────────────────────────────────────────────────────

	async goto(): Promise<void> {
		await this.page.goto(routes.home)
		await this.waitForPageToLoad()
	}

	async assertPageLoaded(): Promise<void> {
		await this.assertAllElementsVisible([
			[this.searchInput, 'Search input'],
			[this.sortSelect, 'Sort select'],
			[this.productCards.first(), 'Product grid'],
		])
	}

	/** Checks a category filter and waits for the filtered grid response. */
	async filterByCategory(categoryId: string): Promise<void> {
		this.log.step(`Filter by category ${categoryId}`)
		await Promise.all([
			this.page.waitForResponse((r) => r.url().includes('/products') && r.status() === 200),
			this.categoryCheckbox(categoryId).check(),
		])
	}

	async searchFor(query: string): Promise<void> {
		this.log.step(`Search for "${query}"`)
		await this.searchInput.fill(query)
		await Promise.all([
			this.page.waitForResponse((r) => r.url().includes('/products/search') && r.status() === 200),
			this.searchSubmitButton.click(),
		])
	}

	async sortBy(value: 'name,asc' | 'name,desc' | 'price,asc' | 'price,desc'): Promise<void> {
		this.log.step(`Sort by ${value}`)
		await this.sortSelect.selectOption(value)
	}

	async openProduct(productId: string): Promise<void> {
		this.log.step(`Open product ${productId}`)
		await this.productCard(productId).click()
	}

	async getVisibleProductNames(): Promise<string[]> {
		await this.productCards.first().waitFor({ state: 'visible' })
		return this.productNames.allTextContents()
	}

	async getVisiblePrices(): Promise<number[]> {
		await this.productCards.first().waitFor({ state: 'visible' })
		const raw = await this.productPrices.allTextContents()
		return raw.map((p) => parseFloat(p.replace('$', '')))
	}

	// ── Assertions ──────────────────────────────────────────────────────────────

	/** Every visible product name must be in the expected set (API truth). */
	async assertGridShowsOnly(expectedNames: string[], context: string): Promise<void> {
		const visible = await this.getVisibleProductNames()
		expect(visible.length, `${context}: grid should not be empty`).toBeGreaterThan(0)
		for (const name of visible) {
			expect.soft(expectedNames, `${context}: unexpected product "${name}" in filtered grid`).toContain(name.trim())
		}
	}

	async assertEveryNameContains(query: string): Promise<void> {
		const visible = await this.getVisibleProductNames()
		expect(visible.length, 'search results should not be empty').toBeGreaterThan(0)
		for (const name of visible) {
			expect.soft(name.toLowerCase(), `result "${name}" should match query "${query}"`).toContain(query.toLowerCase())
		}
	}

	async assertPricesSortedAscending(): Promise<void> {
		// The grid re-renders asynchronously after the sort option changes —
		// poll until the visible prices settle into ascending order.
		await expect
			.poll(
				async () => {
					const prices = await this.getVisiblePrices()
					if (prices.length < 2) return 'grid-empty'
					const sorted = [...prices].sort((a, b) => a - b)
					return JSON.stringify(prices) === JSON.stringify(sorted) ? 'sorted' : `unsorted: ${prices.join(',')}`
				},
				{ message: 'prices should settle into ascending order', timeout: ASSERTION_TIMEOUT }
			)
			.toBe('sorted')
	}
}

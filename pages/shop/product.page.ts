/**
 * pages/shop/product.page.ts — product detail page (/product/:id).
 * Locators verified against live DOM — see docs/context/cart/context.md
 */
import { Page, Locator } from '@playwright/test'

import { routes } from '../../data/routes.data'
import { createLogger } from '../../utils/logger'
import { BasePage } from '../base.page'
import { HeaderComponent } from '../components/header.component'

export class ProductPage extends BasePage {
	private readonly log = createLogger('ProductPage')
	readonly header: HeaderComponent

	constructor(page: Page) {
		super(page)
		this.header = new HeaderComponent(page)
	}

	// ── Locators ────────────────────────────────────────────────────────────────

	private get productName(): Locator {
		return this.page.locator('h1[data-test="product-name"]')
	}

	private get unitPrice(): Locator {
		return this.page.locator('[data-test="unit-price"]')
	}

	private get addToCartButton(): Locator {
		return this.page.locator('[data-test="add-to-cart"]')
	}

	// ── Actions ─────────────────────────────────────────────────────────────────

	async goto(productId: string): Promise<void> {
		await this.page.goto(routes.product(productId))
		await this.waitForPageToLoad()
	}

	async assertPageLoaded(): Promise<void> {
		await this.assertAllElementsVisible([
			[this.productName, 'Product name'],
			[this.unitPrice, 'Unit price'],
			[this.addToCartButton, 'Add to cart button'],
		])
	}

	async addToCart(): Promise<void> {
		this.log.step('Add product to cart')
		await this.addToCartButton.click()
	}

	// ── Assertions ──────────────────────────────────────────────────────────────

	async assertProductName(expected: string): Promise<void> {
		await this.assertElementHasText(this.productName, expected, 'Product name')
	}

	/** Header cart counter — updates asynchronously after add-to-cart. */
	async assertCartQuantity(expected: number): Promise<void> {
		await this.header.assertCartQuantity(expected)
	}
}

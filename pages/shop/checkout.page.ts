/**
 * pages/shop/checkout.page.ts — checkout wizard, step 1 (cart contents).
 * Locators verified against live DOM — see docs/context/cart/context.md
 *
 * NOTE: all wizard steps exist in the DOM simultaneously — assertions must
 * target VISIBLE state, which Playwright's toBeVisible/toHaveText already do.
 */
import { Page, Locator, expect } from '@playwright/test'

import { routes } from '../../data/routes.data'
import { createLogger } from '../../utils/logger'
import { BasePage } from '../base.page'

export class CheckoutPage extends BasePage {
	private readonly log = createLogger('CheckoutPage')

	constructor(page: Page) {
		super(page)
	}

	// ── Locators: step 1 — cart ─────────────────────────────────────────────────

	private get lineTitles(): Locator {
		return this.page.locator('[data-test="product-title"]')
	}

	private get lineQuantityInput(): Locator {
		return this.page.locator('[data-test="product-quantity"]')
	}

	private get linePrice(): Locator {
		return this.page.locator('[data-test="line-price"]')
	}

	private get cartTotal(): Locator {
		return this.page.locator('[data-test="cart-total"]')
	}

	private get proceedToStep2Button(): Locator {
		return this.page.locator('[data-test="proceed-1"]')
	}

	// ── Actions ─────────────────────────────────────────────────────────────────

	async goto(): Promise<void> {
		await this.page.goto(routes.checkout)
		await this.waitForPageToLoad()
	}

	async assertPageLoaded(): Promise<void> {
		await this.assertAllElementsVisible([
			[this.lineTitles.first(), 'Cart line'],
			[this.cartTotal, 'Cart total'],
			[this.proceedToStep2Button, 'Proceed button'],
		])
	}

	async proceedToSignIn(): Promise<void> {
		this.log.step('Proceed to checkout step 2 (sign in)')
		await this.proceedToStep2Button.click()
	}

	// ── Assertions ──────────────────────────────────────────────────────────────

	async assertCartContains(productName: string): Promise<void> {
		await this.assertElementContainsText(this.lineTitles.first(), productName, 'Cart line title')
	}

	async assertCartTotal(expected: string): Promise<void> {
		await this.assertElementHasText(this.cartTotal, expected, 'Cart total')
	}

	async assertLineQuantity(expected: number): Promise<void> {
		await this.assertInputHasValue(this.lineQuantityInput.first(), String(expected), 'Cart line quantity')
	}

	/** Guards against the "added twice → two lines" bug that a total-only check misses. */
	async assertLineCount(expected: number): Promise<void> {
		await expect(this.lineTitles, `cart should have ${expected} line(s)`).toHaveCount(expected)
	}
}

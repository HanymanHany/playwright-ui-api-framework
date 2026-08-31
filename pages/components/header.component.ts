/**
 * pages/components/header.component.ts — the site header, present on every page.
 *
 * The header is not a page, it is a component that appears inside all of them: the
 * identity menu, the sign-out link and the cart badge. Before this file existed those
 * locators were spread across two page objects — the identity menu lived in
 * AccountPage, the cart badge in ProductPage — purely because of where they happened
 * to be needed first.
 *
 * The search box is also in the header and is deliberately NOT here. Only the catalog
 * uses it, and the catalog owns the response it has to wait for. Moving it would be
 * copying a pattern rather than solving a problem.
 *
 * That works until a second page needs the same element. Then you either duplicate
 * the locator or make one page object depend on another, and both are worse than
 * naming the component for what it is.
 *
 * Page objects compose it (`readonly header = new HeaderComponent(page)`) rather
 * than inherit it, because a page HAS a header; it is not a kind of header.
 *
 * Locators verified against live DOM — see docs/context/auth/context.md and
 * docs/context/cart/context.md.
 */
import { Page, Locator } from '@playwright/test'

import { createLogger } from '../../utils/logger'
import { BasePage } from '../base.page'

export class HeaderComponent extends BasePage {
	private readonly log = createLogger('Header')

	constructor(page: Page) {
		super(page)
	}

	// ── Locators ────────────────────────────────────────────────────────────────

	/** Dropdown trigger whose text is the signed-in user's full name. */
	private get userMenu(): Locator {
		return this.page.locator('[data-test="nav-menu"]')
	}

	private get signOutLink(): Locator {
		return this.page.locator('[data-test="nav-sign-out"]')
	}

	private get signInLink(): Locator {
		return this.page.locator('[data-test="nav-sign-in"]')
	}

	private get cartQuantityBadge(): Locator {
		return this.page.locator('[data-test="cart-quantity"]')
	}

	// ── Actions ─────────────────────────────────────────────────────────────────

	async signOut(): Promise<void> {
		this.log.step('Sign out from the header menu')
		await this.userMenu.click()
		await this.signOutLink.click()
	}

	// ── Assertions ──────────────────────────────────────────────────────────────

	/**
	 * The header greets the signed-in user by name. This is the only assertion that
	 * proves WHO is signed in — a redirect to /account proves only that a redirect
	 * happened.
	 */
	async assertSignedInAs(fullName: string): Promise<void> {
		await this.assertElementContainsText(this.userMenu, fullName, 'Header user menu')
	}

	async assertSignedOut(): Promise<void> {
		await this.assertElementVisible(this.signInLink, 'Header sign-in link')
	}

	/** The badge updates asynchronously after add-to-cart — assert on it, not on the toast. */
	async assertCartQuantity(expected: number): Promise<void> {
		await this.assertElementHasText(this.cartQuantityBadge, String(expected), 'Header cart badge')
	}
}

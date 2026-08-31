/**
 * pages/account/favorites.page.ts — favorites list (/account/favorites).
 * Locators verified against live DOM — see docs/context/favorites/context.md
 *
 * Card data-test uses the FAVORITE id (not product id) — hybrid tests capture
 * the id from the POST /favorites response and assert on that exact card.
 */
import { Page, Locator } from '@playwright/test'

import { labels } from '../../data/labels.data'
import { ACTION_TIMEOUT } from '../../config/timeouts'
import { routes } from '../../data/routes.data'
import { createLogger } from '../../utils/logger'
import { BasePage } from '../base.page'

export class FavoritesPage extends BasePage {
	private readonly log = createLogger('FavoritesPage')

	constructor(page: Page) {
		super(page)
	}

	// ── Locators ────────────────────────────────────────────────────────────────

	private get pageTitle(): Locator {
		return this.page.locator('[data-test="page-title"]')
	}

	private favoriteCard(favoriteId: string): Locator {
		return this.page.locator(`[data-test="favorite-${favoriteId}"]`)
	}

	private favoriteCardName(favoriteId: string): Locator {
		return this.favoriteCard(favoriteId).locator('[data-test="product-name"]')
	}

	private favoriteCardDeleteButton(favoriteId: string): Locator {
		return this.favoriteCard(favoriteId).locator('[data-test="delete"]')
	}

	// ── Actions ─────────────────────────────────────────────────────────────────

	async goto(): Promise<void> {
		await this.page.goto(routes.favorites)
		await this.waitForPageToLoad()
	}

	async assertPageLoaded(): Promise<void> {
		await this.assertElementHasText(this.pageTitle, labels.favorites.pageTitle, 'Favorites page title')
	}

	async deleteFavorite(favoriteId: string): Promise<void> {
		this.log.step(`Delete favorite ${favoriteId}`)
		await this.favoriteCardDeleteButton(favoriteId).click()
	}

	// ── Assertions ──────────────────────────────────────────────────────────────

	async assertFavoriteVisible(favoriteId: string, productName: string): Promise<void> {
		await this.assertElementVisible(this.favoriteCard(favoriteId), `Favorite card ${favoriteId}`)
		await this.assertElementContainsText(this.favoriteCardName(favoriteId), productName, 'Favorite product name')
	}

	async assertFavoriteGone(favoriteId: string): Promise<void> {
		await this.favoriteCard(favoriteId).waitFor({ state: 'detached', timeout: ACTION_TIMEOUT })
	}
}

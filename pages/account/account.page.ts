/**
 * pages/account/account.page.ts — the account landing page (/account).
 * Locators verified against live DOM — see docs/context/auth/context.md
 *
 * Identity lives in the header, which is a component this page composes rather than
 * owns — the same header is on every page, and "who is signed in?" is asked from
 * several of them.
 */
import { Page, Locator } from '@playwright/test'

import { labels } from '../../data/labels.data'
import { routes } from '../../data/routes.data'
import { createLogger } from '../../utils/logger'
import { BasePage } from '../base.page'
import { HeaderComponent } from '../components/header.component'

export class AccountPage extends BasePage {
	private readonly log = createLogger('AccountPage')
	readonly header: HeaderComponent

	constructor(page: Page) {
		super(page)
		this.header = new HeaderComponent(page)
	}

	// ── Locators ────────────────────────────────────────────────────────────────

	private get pageTitle(): Locator {
		return this.page.locator('[data-test="page-title"]')
	}

	private get favoritesTile(): Locator {
		return this.page.locator('[data-test="nav-favorites"]')
	}

	private get profileTile(): Locator {
		return this.page.locator('[data-test="nav-profile"]')
	}

	// ── Actions ─────────────────────────────────────────────────────────────────

	async goto(): Promise<void> {
		await this.page.goto(routes.account)
		await this.waitForPageToLoad()
	}

	async assertPageLoaded(): Promise<void> {
		await this.assertAllElementsVisible([
			[this.pageTitle, 'Account page title'],
			[this.favoritesTile, 'Favorites tile'],
			[this.profileTile, 'Profile tile'],
		])
	}

	async openProfile(): Promise<void> {
		this.log.step('Open profile from the account page')
		await this.profileTile.click()
	}

	async signOut(): Promise<void> {
		await this.header.signOut()
	}

	// ── Assertions ──────────────────────────────────────────────────────────────

	async assertOnAccountPage(): Promise<void> {
		await this.assertUrlPath(routes.account, 'Account page')
		await this.assertElementHasText(this.pageTitle, labels.account.pageTitle, 'Account page title')
	}

	/** The header greets the signed-in user by name — proof of WHO is logged in. */
	async assertSignedInAs(fullName: string): Promise<void> {
		await this.header.assertSignedInAs(fullName)
	}

	async assertSignedOut(): Promise<void> {
		await this.assertUrlPath(routes.login, 'Login page after sign out')
	}
}

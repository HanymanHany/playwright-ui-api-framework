/**
 * pages/account/profile.page.ts — profile form (/account/profile).
 * Locators verified against live DOM — see docs/context/auth/context.md
 *
 * Used by the hybrid profile test: the form is edited in the UI and the result is
 * verified through GET /users/me. Asserting a success toast would only prove the
 * app rendered a toast; asking the API proves the change was actually persisted.
 */
import { Page, Locator } from '@playwright/test'

import { labels } from '../../data/labels.data'
import { routes } from '../../data/routes.data'
import { createLogger } from '../../utils/logger'
import { BasePage } from '../base.page'

export class ProfilePage extends BasePage {
	private readonly log = createLogger('ProfilePage')

	constructor(page: Page) {
		super(page)
	}

	// ── Locators ────────────────────────────────────────────────────────────────

	private get pageTitle(): Locator {
		return this.page.locator('[data-test="page-title"]')
	}

	private get firstNameInput(): Locator {
		return this.page.locator('[data-test="first-name"]')
	}

	private get lastNameInput(): Locator {
		return this.page.locator('[data-test="last-name"]')
	}

	private get emailInput(): Locator {
		return this.page.locator('[data-test="email"]')
	}

	private get phoneInput(): Locator {
		return this.page.locator('[data-test="phone"]')
	}

	private get cityInput(): Locator {
		return this.page.locator('[data-test="city"]')
	}

	private get updateButton(): Locator {
		return this.page.locator('[data-test="update-profile-submit"]')
	}

	// ── Actions ─────────────────────────────────────────────────────────────────

	async goto(): Promise<void> {
		await this.page.goto(routes.profile)
		await this.waitForPageToLoad()
	}

	async assertPageLoaded(): Promise<void> {
		await this.assertAllElementsVisible([
			[this.pageTitle, 'Profile page title'],
			[this.firstNameInput, 'First name input'],
			[this.emailInput, 'Email input'],
			[this.updateButton, 'Update profile button'],
		])
	}

	/** Edits the fields we own and waits for the PUT to return. */
	async updateContactDetails(changes: { phone: string; city: string }): Promise<number> {
		this.log.step(`Update profile: phone=${changes.phone}, city=${changes.city}`)
		await this.phoneInput.fill(changes.phone)
		await this.cityInput.fill(changes.city)
		const [response] = await Promise.all([
			this.page.waitForResponse((r) => r.url().includes('/users/') && r.request().method() === 'PUT'),
			this.updateButton.click(),
		])
		return response.status()
	}

	// ── Assertions ──────────────────────────────────────────────────────────────

	async assertOnProfilePage(): Promise<void> {
		await this.assertUrlPath(routes.profile, 'Profile page')
		await this.assertElementHasText(this.pageTitle, labels.profile.pageTitle, 'Profile page title')
	}

	/** The form is prefilled from the API — this checks it shows OUR user. */
	async assertPrefilledWith(details: { firstName: string; lastName: string; email: string }): Promise<void> {
		await this.assertInputHasValue(this.firstNameInput, details.firstName, 'First name input')
		await this.assertInputHasValue(this.lastNameInput, details.lastName, 'Last name input')
		await this.assertInputHasValue(this.emailInput, details.email, 'Email input')
	}
}

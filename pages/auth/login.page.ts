/**
 * pages/auth/login.page.ts — login form (/auth/login).
 * Locators verified against live DOM — see docs/context/auth/context.md
 */
import { Page, Locator } from '@playwright/test'

import { labels } from '../../data/labels.data'
import { routes } from '../../data/routes.data'
import { createLogger } from '../../utils/logger'
import { BasePage } from '../base.page'

export class LoginPage extends BasePage {
	private readonly log = createLogger('LoginPage')

	constructor(page: Page) {
		super(page)
	}

	// ── Locators ────────────────────────────────────────────────────────────────

	private get emailInput(): Locator {
		return this.page.locator('[data-test="email"]')
	}

	private get passwordInput(): Locator {
		return this.page.locator('[data-test="password"]')
	}

	private get submitButton(): Locator {
		return this.page.locator('[data-test="login-submit"]')
	}

	private get loginError(): Locator {
		return this.page.locator('[data-test="login-error"]')
	}

	private get accountPageTitle(): Locator {
		return this.page.locator('[data-test="page-title"]')
	}

	// ── Actions ─────────────────────────────────────────────────────────────────

	async goto(): Promise<void> {
		await this.page.goto(routes.login)
		await this.waitForPageToLoad()
	}

	async assertPageLoaded(): Promise<void> {
		await this.assertAllElementsVisible([
			[this.emailInput, 'Email input'],
			[this.passwordInput, 'Password input'],
			[this.submitButton, 'Login submit button'],
		])
	}

	async login(email: string, password: string): Promise<void> {
		this.log.step(`Login as ${email}`)
		await this.emailInput.fill(email)
		await this.passwordInput.fill(password)
		await this.submitButton.click()
	}

	// ── Assertions ──────────────────────────────────────────────────────────────

	/** Successful login redirects to /account with the "My account" title. */
	async assertLoginSucceeded(): Promise<void> {
		await this.assertUrlPath(routes.account, 'Account page')
		await this.assertElementHasText(this.accountPageTitle, labels.account.pageTitle, 'Account page title')
	}

	async assertLoginErrorVisible(): Promise<void> {
		await this.assertElementVisible(this.loginError, 'Login error message')
	}

	async assertStillOnLoginPage(): Promise<void> {
		await this.assertUrlPath(routes.login, 'Login page')
	}
}

/**
 * pages/auth/register.page.ts — customer registration form (/auth/register).
 * Locators verified against live DOM — see docs/context/auth/context.md
 *
 * The form has two rules that only the API reveals, and both are asserted by
 * tests rather than commented away:
 *   - password must contain upper, lower, digit and symbol, and is checked
 *     against a breach list (so "Welcome01!" is rejected)
 *   - date of birth must be between 18 and 75 years ago
 */
import { Page, Locator } from '@playwright/test'

import { ACTION_TIMEOUT } from '../../config/timeouts'
import { routes } from '../../data/routes.data'
import type { RegistrationForm } from '../../data/test-user.data'
import { createLogger } from '../../utils/logger'
import { BasePage } from '../base.page'

export class RegisterPage extends BasePage {
	private readonly log = createLogger('RegisterPage')

	constructor(page: Page) {
		super(page)
	}

	// ── Locators ────────────────────────────────────────────────────────────────

	private get form(): Locator {
		return this.page.locator('[data-test="register-form"]')
	}

	private get firstNameInput(): Locator {
		return this.page.locator('[data-test="first-name"]')
	}

	private get lastNameInput(): Locator {
		return this.page.locator('[data-test="last-name"]')
	}

	private get dobInput(): Locator {
		return this.page.locator('[data-test="dob"]')
	}

	private get countrySelect(): Locator {
		return this.page.locator('[data-test="country"]')
	}

	private get postalCodeInput(): Locator {
		return this.page.locator('[data-test="postal_code"]')
	}

	private get houseNumberInput(): Locator {
		return this.page.locator('[data-test="house_number"]')
	}

	private get streetInput(): Locator {
		return this.page.locator('[data-test="street"]')
	}

	private get cityInput(): Locator {
		return this.page.locator('[data-test="city"]')
	}

	private get stateInput(): Locator {
		return this.page.locator('[data-test="state"]')
	}

	private get phoneInput(): Locator {
		return this.page.locator('[data-test="phone"]')
	}

	private get emailInput(): Locator {
		return this.page.locator('[data-test="email"]')
	}

	private get passwordInput(): Locator {
		return this.page.locator('[data-test="password"]')
	}

	private get submitButton(): Locator {
		return this.page.locator('[data-test="register-submit"]')
	}

	/** Angular renders field errors as .alert / .invalid-feedback inside the form. */
	private get validationMessages(): Locator {
		return this.form.locator('.alert-danger, .invalid-feedback, .error')
	}

	// ── Actions ─────────────────────────────────────────────────────────────────

	async goto(): Promise<void> {
		await this.page.goto(routes.register)
		await this.waitForPageToLoad()
	}

	async assertPageLoaded(): Promise<void> {
		await this.assertAllElementsVisible([
			[this.form, 'Registration form'],
			[this.emailInput, 'Email input'],
			[this.passwordInput, 'Password input'],
			[this.submitButton, 'Register button'],
		])
	}

	/**
	 * Two things here were found by looking at the live form, not by reading the API.
	 *
	 * 1. Country is selected by VALUE (the ISO code), never by visible label.
	 *    The label for NL is "Netherlands (the)", not "Netherlands", and the app
	 *    ships eight locales — the option text changes with the language, the value
	 *    does not. Selecting by label gives you a test that breaks the day someone
	 *    changes the default locale, for a reason unrelated to registration.
	 *
	 * 2. `house_number` is required by the FORM but optional in the API schema.
	 *    Leaving it empty makes Angular block the submit client-side, so no request
	 *    is ever sent — which looks exactly like a broken test, not a validation
	 *    rule. The UI is stricter than the contract, and only the browser knows.
	 */
	async fillForm(details: RegistrationForm): Promise<void> {
		this.log.step(`Fill registration form for ${details.email}`)
		await this.firstNameInput.fill(details.firstName)
		await this.lastNameInput.fill(details.lastName)
		await this.dobInput.fill(details.dob)
		await this.countrySelect.selectOption(details.countryCode)
		await this.postalCodeInput.fill(details.postalCode)
		await this.houseNumberInput.fill(details.houseNumber)
		await this.streetInput.fill(details.street)
		await this.cityInput.fill(details.city)
		await this.stateInput.fill(details.state)
		await this.phoneInput.fill(details.phone)
		await this.emailInput.fill(details.email)
		await this.passwordInput.fill(details.password)
	}

	/**
	 * Clicks Register and reports what the network did.
	 *
	 * Returns the HTTP status, or `null` when no request was sent at all — Angular
	 * validates the form before submitting, so a client-side rejection produces no
	 * traffic. An unconditional `waitForResponse` here would hang for the full test
	 * timeout and report "browser closed", which tells you nothing about the cause.
	 * Distinguishing "the server said no" from "the form never asked" is the whole
	 * point of returning null instead of throwing.
	 */
	async submit(): Promise<number | null> {
		this.log.step('Submit registration')
		const responsePromise = this.page
			.waitForResponse((r) => r.url().includes('/users/register'), { timeout: ACTION_TIMEOUT })
			.catch(() => null)
		await this.submitButton.click()
		const response = await responsePromise
		return response?.status() ?? null
	}

	// ── Assertions ──────────────────────────────────────────────────────────────

	/** A successful registration sends the user to the login page. */
	async assertRegistrationSucceeded(): Promise<void> {
		await this.assertUrlPath(routes.login, 'Login page after registration')
	}

	/**
	 * Asserts the user is actually shown WHY it failed, not merely that something
	 * went red. A test that only checks "an alert exists" passes when the app
	 * renders "Error" and calls it a day.
	 */
	async assertValidationErrorContains(text: string): Promise<void> {
		await this.assertElementContainsText(this.validationMessages.first(), text, 'Validation message')
	}

	async assertStillOnRegisterPage(): Promise<void> {
		await this.assertUrlPath(routes.register, 'Register page')
	}
}

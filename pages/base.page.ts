import { Page, Locator, expect } from '@playwright/test'

import { NAVIGATION_TIMEOUT } from '../config/timeouts'

/**
 * BasePage — common utilities for all Page Objects.
 *
 * Access levels:
 *   public    — navigation waits, URL assertions (called from tests / page objects)
 *   protected — element-level assertions (called only from page object methods)
 *
 * Tests must NOT call protected assert methods directly — page objects expose
 * named assert*() methods that wrap these with element names, so a failure reads
 * "Login submit button should be visible" instead of a bare locator timeout.
 */
export class BasePage {
	protected readonly page: Page

	constructor(page: Page) {
		this.page = page
	}

	// ── Navigation ──────────────────────────────────────────────────────────────

	async waitForPageToLoad(): Promise<void> {
		await this.page.waitForLoadState('load')
		await this.page.waitForLoadState('networkidle') // eslint-disable-line playwright/no-networkidle
	}

	/** Asserts only the pathname portion of the current URL. */
	async assertUrlPath(expectedPath: string | RegExp, pageName = 'page'): Promise<void> {
		if (typeof expectedPath === 'string') {
			await this.page.waitForURL(new RegExp(expectedPath.replace(/\//g, '\\/')), { timeout: NAVIGATION_TIMEOUT })
			const url = new URL(this.page.url())
			expect(url.pathname, `${pageName} path should be "${expectedPath}"`).toBe(expectedPath)
		} else {
			await this.page.waitForURL(expectedPath, { timeout: NAVIGATION_TIMEOUT })
			expect(this.page.url()).toMatch(expectedPath)
		}
	}

	// ── Element assertions (protected — page objects only) ─────────────────────

	protected async assertElementVisible(locator: Locator, elementName = 'element'): Promise<void> {
		await expect(locator, `"${elementName}" should be visible`).toBeVisible()
	}

	protected async assertElementHasText(locator: Locator, expected: string, elementName = 'element'): Promise<void> {
		await expect(locator, `"${elementName}" should have text "${expected}"`).toHaveText(expected)
	}

	protected async assertElementContainsText(locator: Locator, text: string, elementName = 'element'): Promise<void> {
		await expect(locator, `"${elementName}" should contain "${text}"`).toContainText(text)
	}

	/**
	 * Form fields are asserted on their VALUE, not their text — `toHaveValue`
	 * also retries, which matters for inputs prefilled by an async API call.
	 */
	protected async assertInputHasValue(locator: Locator, expected: string, elementName = 'input'): Promise<void> {
		await expect(locator, `"${elementName}" should have value "${expected}"`).toHaveValue(expected)
	}

	/**
	 * Soft-asserts visibility of several elements at once — failures are collected,
	 * so assertPageLoaded() reports ALL missing elements, not just the first.
	 */
	protected async assertAllElementsVisible(pairs: Array<[Locator, string]>): Promise<void> {
		for (const [locator, name] of pairs) {
			await expect.soft(locator, `"${name}" should be visible`).toBeVisible()
		}
	}
}

/**
 * core/allure-categories.ts — failure triage rules for the Allure report.
 *
 * Written to `allure-results/categories.json` by global-setup.
 *
 * WHY BOTHER
 *
 * A report that says "7 failed" starts a meeting. A report that says "5 product
 * defects, 1 test defect, 1 environment problem" starts a fix. The first question
 * after a red run is never "how many" — it is "is this us or them", and answering
 * it by hand costs the automation engineer an hour every morning.
 *
 * These buckets encode the triage an experienced person does by reflex, so the
 * report does it for everyone at 3am.
 */
import * as fs from 'fs'
import * as path from 'path'

interface AllureCategory {
	name: string
	matchedStatuses: string[]
	messageRegex?: string
	traceRegex?: string
}

const CATEGORIES: AllureCategory[] = [
	{
		// The suite could not even start properly — nothing below this is trustworthy.
		name: 'Setup / environment problem',
		matchedStatuses: ['broken', 'failed'],
		messageRegex: '.*(global-setup did not run|Run user not found|OpenAPI spec not found).*',
	},
	{
		/**
		 * The network, not the product and not the test.
		 *
		 * This bucket is the reason `retries: 0` is defensible. The instinct when a
		 * run goes red on a dropped connection is to add a retry — and that same
		 * retry then silently swallows the real races it was never meant to cover.
		 * Classifying instead of retrying keeps the signal: a human sees "1 network
		 * failure, 0 product defects" and reruns, rather than seeing green and
		 * learning nothing.
		 */
		name: 'Network / connectivity',
		matchedStatuses: ['broken', 'failed'],
		messageRegex: '.*(fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|socket hang up|net::ERR_).*',
	},
	{
		// The API and the spec disagree: someone shipped a contract change.
		name: 'Contract drift (API vs OpenAPI spec)',
		matchedStatuses: ['failed'],
		messageRegex: '.*(violates the spec|missing from the spec).*',
	},
	{
		// The element is not there. Usually a real UI change, sometimes a stale locator.
		name: 'UI changed or locator is stale',
		matchedStatuses: ['failed', 'broken'],
		messageRegex: '.*(locator\\.|toBeVisible|waiting for locator).*',
	},
	{
		// Auth is the first thing to check when everything fails at once.
		name: 'Authentication / token problem',
		matchedStatuses: ['failed', 'broken'],
		messageRegex: '.*(401|403|Unauthorized|Forbidden|token).*',
	},
	{
		// Two tests fought over the same entity — an isolation bug, not a product bug.
		name: 'Test data collision',
		matchedStatuses: ['failed'],
		messageRegex: '.*(409|Duplicate|already exists).*',
	},
	{
		// Everything else that is an assertion is, until proven otherwise, a real defect.
		name: 'Product defect',
		matchedStatuses: ['failed'],
	},
]

export function writeAllureCategories(resultsDir = 'allure-results'): void {
	fs.mkdirSync(resultsDir, { recursive: true })
	fs.writeFileSync(path.join(resultsDir, 'categories.json'), JSON.stringify(CATEGORIES, null, 2))
}

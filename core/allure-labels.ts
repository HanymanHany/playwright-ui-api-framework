/**
 * core/allure-labels.ts — Allure metadata derived from what the test already declares.
 *
 * WHY NOT WRITE THE LABELS IN EACH TEST
 *
 * The usual way is `allure.severity('critical')` at the top of every test. With 34
 * tests that is 34 lines of metadata to keep honest, and they drift: someone adds a
 * smoke test and forgets the severity, someone changes a tag and leaves the label.
 * A month later the report's severity filter is decorative.
 *
 * Every test here already declares a tag and sits in a `[Section / SubSection]`
 * describe. That is enough information — so the labels are computed from it, once,
 * in an auto fixture. One place to change the policy, and it cannot go stale.
 *
 * What the report gains, and who reads it (from the CI/CD article's three audiences):
 *   - severity → the lead filters "show me only critical failures"
 *   - layer    → is the API broken, or only the browser layer?
 *   - feature  → which product area is red this week
 *   - owner    → who to ask
 */
import { allure } from 'allure-playwright'

import type { TestInfo } from '@playwright/test'

/**
 * Severity comes from the tag the test already carries. Order matters: the first
 * match wins, so a `@smoke @negative` test is critical, not normal.
 */
const SEVERITY_BY_TAG: Array<[string, string]> = [
	['@smoke', 'critical'],
	['@contract', 'critical'],
	['@security', 'critical'],
	['@regression', 'normal'],
	['@negative', 'normal'],
]

function severityFor(tags: string[]): string {
	for (const [tag, severity] of SEVERITY_BY_TAG) {
		if (tags.includes(tag)) return severity
	}
	return 'minor'
}

/** tests/hybrid/profile.spec.ts → "hybrid". The layer that broke is the first question. */
function layerFor(file: string): string {
	const match = /tests[\\/](\w+)[\\/]/.exec(file)
	return match?.[1] ?? 'other'
}

/**
 * "[UI / Auth / Login]" → feature "Auth", story "Login".
 * The convention is enforced by the code-review skill, so this parse is safe;
 * when it is not, we fall back rather than throw — a reporting helper must never
 * be the reason a test fails.
 */
function featureAndStory(describeTitle: string | undefined): { feature: string; story?: string } {
	const parts = (describeTitle ?? '')
		.replace(/^\[|\]$/g, '')
		.split('/')
		.map((p) => p.trim())
		.filter(Boolean)

	if (parts.length >= 3) return { feature: parts[1]!, story: parts.slice(2).join(' / ') }
	if (parts.length === 2) return { feature: parts[1]! }
	return { feature: parts[0] ?? 'Uncategorised' }
}

export async function applyAllureLabels(testInfo: TestInfo): Promise<void> {
	// titlePath = [project, file, ...describes, test title]
	const describeTitle = testInfo.titlePath.find((part) => part.startsWith('['))
	const { feature, story } = featureAndStory(describeTitle)

	await allure.severity(severityFor(testInfo.tags))
	await allure.layer(layerFor(testInfo.file))
	await allure.feature(feature)
	if (story) await allure.story(story)
	await allure.owner(process.env.ALLURE_OWNER ?? 'QA Automation')
}

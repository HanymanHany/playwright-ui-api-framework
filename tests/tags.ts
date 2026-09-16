/**
 * tests/tags.ts — the only place a tag exists.
 *
 * WHY A REGISTRY INSTEAD OF STRING LITERALS
 *
 * Tags are the suite's filtering interface: `npm run test:smoke`, the tag input of the
 * CI workflow, the severity mapping in `core/allure-labels.ts`. And a mistyped tag
 * fails silently in the worst possible direction — `@smok` does not error, it just
 * removes that test from the smoke run. Nothing is red, the report looks healthy, and
 * the test is simply never executed again.
 *
 * Referencing a constant turns that into a compile error. `scripts/check-tags.mjs`
 * closes the other half: it refuses a raw `'@...'` literal in a spec, so the registry
 * cannot be bypassed by someone who has not read this file.
 *
 * Adding a tag: add it here, and if it should affect report severity, map it in
 * `core/allure-labels.ts`.
 */
export const TAGS = {
	/** The handful of tests that answer "is the system fundamentally alive". Runs on every push. */
	smoke: '@smoke',
	/** The broad safety net. */
	regression: '@regression',

	// ── Layer ───────────────────────────────────────────────────────────────────
	api: '@api',
	ui: '@ui',
	hybrid: '@hybrid',

	// ── Kind of check ───────────────────────────────────────────────────────────
	/** The server is expected to refuse. */
	negative: '@negative',
	/** Authentication, authorisation, or data that must not leak. */
	security: '@security',
	/** Live responses checked against the published OpenAPI document. */
	contract: '@contract',

	/**
	 * The three tests that fail on purpose, to document what a failure looks like in
	 * the report. Local runs include them; CI excludes them.
	 */
	demo: '@demo',
} as const

export type Tag = (typeof TAGS)[keyof typeof TAGS]

/** Every registered tag — used by the guard script and by anything that validates a filter. */
export const ALL_TAGS: readonly string[] = Object.values(TAGS)

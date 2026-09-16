/**
 * api/expect.ts — assertions that say what actually happened.
 *
 * `expect(response.status).toBe(422)` fails with "expected 422, received 400" and
 * leaves the reader guessing which field the server disliked. In CI, where the run
 * cannot be repeated by scrolling up, that guess costs a reproduction round.
 *
 * Every helper here puts the response body into the failure message, so the first
 * line of a red test already contains the answer. The body is redacted the same way
 * the traffic attachment is — a password typed into a negative test must not turn up
 * in a build log.
 *
 * CONVENTION NOTE
 *
 * Specs import `test`/`expect` from `fixtures/base.fixture` and nowhere else. This
 * file is the one exception: it is not a spec, it is the assertion layer those specs
 * call, and importing the fixture from here would be a cycle.
 */
import { expect } from '@playwright/test'

import { redact } from './traffic'

/** What the `*Raw` client methods return: the status, and whatever the server sent. */
export interface RawResponse {
	status: number
	body: unknown
}

const MAX_PREVIEW = 600

function preview(body: unknown): string {
	const text = JSON.stringify(redact(body))
	if (!text) return String(body)
	return text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW)}… (${text.length} chars)` : text
}

/**
 * Asserts the exact status and returns the body, so a check reads as one line:
 *
 * ```ts
 * const body = expectStatus(response, 422, 'registration with a breached password')
 * ```
 */
export function expectStatus(response: RawResponse, expected: number, what = 'response'): unknown {
	expect(response.status, `${what}: expected ${expected}, body was ${preview(response.body)}`).toBe(expected)
	return response.body
}

/**
 * Asserts the status is a client error — 4xx, not 5xx.
 *
 * The distinction is the point: "the API rejected this" and "the API fell over while
 * rejecting this" are different results, and only one of them is a passing test.
 */
export function expectClientError(response: RawResponse, what = 'response'): unknown {
	expect(
		response.status,
		`${what}: expected a 4xx, got ${response.status}, body ${preview(response.body)}`
	).toBeGreaterThanOrEqual(400)
	expect(response.status, `${what}: expected a 4xx, got a server error, body ${preview(response.body)}`).toBeLessThan(
		500
	)
	return response.body
}

/**
 * Asserts the status AND that the error text names a specific field.
 *
 * A validation test that only checks the status passes just as happily when the
 * server starts rejecting the request for an entirely different reason — the wrong
 * field, or a rate limit. Naming the field is what makes it a test of the rule.
 */
export function expectRejectedField(response: RawResponse, expected: number, field: string, what = 'response'): void {
	expectStatus(response, expected, what)
	expect(
		JSON.stringify(response.body).toLowerCase(),
		`${what}: the error should name "${field}" — body was ${preview(response.body)}`
	).toContain(field.toLowerCase())
}

/** For checks where several statuses are legitimately acceptable. */
export function expectStatusIn(response: RawResponse, allowed: number[], what = 'response'): unknown {
	expect(allowed, `${what}: got ${response.status}, body ${preview(response.body)}`).toContain(response.status)
	return response.body
}

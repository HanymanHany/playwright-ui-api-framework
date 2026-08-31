/**
 * config/timeouts.ts — every waiting period in the framework, in one place.
 *
 * These used to be inline numbers: `45_000` in the config, `10_000` in BasePage,
 * another `10_000` in RegisterPage. Three files, no relationship between them
 * expressed anywhere, and no way to answer "why is this one ten seconds?" except
 * by guessing.
 *
 * They are also not arbitrary. There is an order that has to hold:
 *
 *     ACTION < NAVIGATION < ASSERTION < TEST
 *
 * If an element wait can outlive the test timeout, the failure you get is
 * "Test timeout of 45000ms exceeded" — which names the wrong thing and hides which
 * step actually hung. Keeping them together is what makes that constraint visible.
 */

/** A single UI interaction: click, fill, one XHR round trip. */
export const ACTION_TIMEOUT = 10_000

/** Page load or a URL change after a redirect. */
export const NAVIGATION_TIMEOUT = 10_000

/** An `expect()` retrying until the app settles (async re-render, late render). */
export const ASSERTION_TIMEOUT = 10_000

/**
 * The whole test. Must exceed the sum of the waits a single test can realistically
 * stack, or the real cause gets replaced by a generic timeout message.
 */
export const TEST_TIMEOUT = 45_000

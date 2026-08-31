/**
 * data/test-user.data.ts — every user this suite creates, built in one place.
 *
 * WHY THIS FILE EXISTS
 *
 * The same account payload was written out three times: once in `core/run-user.ts`,
 * once in the API registration spec, once in the UI registration spec. Same address,
 * same date of birth, same password recipe, three copies. Change the password rule
 * on the backend and you fix it in one place, the suite still fails in the other two,
 * and the failure looks unrelated to what you just changed.
 *
 * It is also where the API's real validation rules live as code rather than as
 * folklore. They came from the OpenAPI description fields and were confirmed live:
 *
 *   - password must contain upper, lower, digit and symbol AND must not appear in a
 *     known breach list — the API checks, and refuses "Welcome01!"
 *   - date of birth must be between 18 and 75 years ago
 *   - the registration FORM additionally requires house_number, which the API
 *     schema marks optional
 *
 * Everything unique carries RUN_ID, so two runs never collide on the unique-email
 * constraint — including two CI runs of different branches at the same moment.
 */
import { RUN_ID } from '../config/env'

import type { NewUser } from '../api/types'

// ── Fixed attributes ──────────────────────────────────────────────────────────

/** ISO 3166-1 alpha-2. Selected by value, never by label — the app ships 8 locales. */
export const COUNTRY_CODE = 'NL'

export const TEST_ADDRESS = {
	street: 'Test Street 1',
	houseNumber: '12',
	city: 'Amsterdam',
	state: 'NH',
	postalCode: '1234AB',
} as const

/** Comfortably inside the 18–75 window the API enforces. */
export const TEST_DOB = '1990-01-01'

export const TEST_PHONE = '0123456789'

/**
 * A password the API is known to refuse because it appears in a public breach list.
 * Used by the negative tests on both layers — it must stay a compromised password,
 * so do not "fix" it to something stronger.
 */
export const BREACHED_PASSWORD = 'Welcome01!'

// ── Generators ────────────────────────────────────────────────────────────────

/**
 * `example.com` is reserved by RFC 2606 for exactly this. It cannot receive mail,
 * which is the point: nothing this suite creates can ever reach a real inbox.
 */
export function uniqueEmail(prefix: string): string {
	return `pw-${prefix}-${RUN_ID}@example.com`
}

/** Satisfies the complexity rule and is unique per run, so it is never a breached one. */
export function strongPassword(): string {
	return `Pw!${RUN_ID}#Aq7`
}

// ── Shapes ────────────────────────────────────────────────────────────────────

export interface TestUser extends NewUser {
	password: string
}

/** The API payload: snake_case, nested address — matches `POST /users/register`. */
export function buildApiUser(prefix: string, overrides: Partial<TestUser> = {}): TestUser {
	return {
		first_name: 'Playwright',
		last_name: `Run ${RUN_ID}`,
		email: uniqueEmail(prefix),
		password: strongPassword(),
		dob: TEST_DOB,
		phone: TEST_PHONE,
		address: {
			street: TEST_ADDRESS.street,
			house_number: TEST_ADDRESS.houseNumber,
			city: TEST_ADDRESS.city,
			state: TEST_ADDRESS.state,
			country: COUNTRY_CODE,
			postal_code: TEST_ADDRESS.postalCode,
		},
		...overrides,
	}
}

/**
 * What the registration FORM needs: flat, camelCase, plus `houseNumber`, which the
 * form requires and the API does not.
 *
 * This type lives here rather than in the page object because the form's input shape
 * is test data, not UI structure — `pages/auth/register.page.ts` imports it from here.
 */
export interface RegistrationForm {
	firstName: string
	lastName: string
	dob: string
	/** ISO 3166-1 alpha-2 code — the `<select>` is driven by value, not label. */
	countryCode: string
	postalCode: string
	/** Required by the form, optional in the API schema. */
	houseNumber: string
	street: string
	city: string
	state: string
	phone: string
	email: string
	password: string
}

/** The same account, shaped for the UI form. One source, two shapes. */
export function buildRegistrationForm(prefix: string, overrides: Partial<RegistrationForm> = {}): RegistrationForm {
	return {
		firstName: 'Playwright',
		lastName: `Run ${RUN_ID}`,
		dob: TEST_DOB,
		countryCode: COUNTRY_CODE,
		postalCode: TEST_ADDRESS.postalCode,
		houseNumber: TEST_ADDRESS.houseNumber,
		street: TEST_ADDRESS.street,
		city: TEST_ADDRESS.city,
		state: TEST_ADDRESS.state,
		phone: TEST_PHONE,
		email: uniqueEmail(prefix),
		password: strongPassword(),
		...overrides,
	}
}

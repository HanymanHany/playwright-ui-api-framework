/**
 * api/client.ts — the typed HTTP layer, generated-path-aware.
 *
 * WHY THIS REPLACED A HAND-WRITTEN FETCH WRAPPER
 *
 * The previous version took the path as a string: `http.get('/products/' + id)`.
 * It worked, and it let one specific bug through: the spec defines the path as
 * `/products/{productId}` and this project called it `/products/{id}`. Nothing
 * complained. The contract test caught it at runtime, against a live server.
 *
 * `openapi-fetch` types the path against the generated schema, so the same mistake
 * is now a type error — caught by `npm run typecheck` in two seconds, with no
 * network involved. Path params, query params and request bodies are checked the
 * same way. It weighs about 6 kB and adds no runtime behaviour of its own.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It performs no runtime validation — it trusts the types. That is fine here,
 * because trust is exactly what `tests/contract/contract.api.spec.ts` verifies
 * against the same spec the types came from. Adding Zod schemas would mean a
 * SECOND hand-maintained description of the same responses, which is the drift
 * problem this project already removed once.
 *
 * The two helpers below keep the calling style the clients already had: throw on
 * an unexpected status, or return status + body for negative tests.
 */
import createClient from 'openapi-fetch'

import type { paths } from './generated/schema'

export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly body: unknown
	) {
		super(message)
		this.name = 'ApiError'
	}
}

/** A response as openapi-fetch returns it: exactly one of data / error is set. */
export interface FetchResult<T> {
	data?: T
	error?: unknown
	response: Response
}

export type ApiClient = ReturnType<typeof createClient<paths>>

export function createApiClient(baseUrl: string): ApiClient {
	return createClient<paths>({ baseUrl })
}

/**
 * Returns the body of a successful response, or throws with the status and body
 * attached. `context` names the call so a failure reads "POST /favorites failed: 422"
 * instead of a bare rejected promise.
 */
export function unwrap<T>(result: FetchResult<T>, context: string): T {
	if (result.error !== undefined || !result.response.ok) {
		throw new ApiError(
			`${context} failed: ${result.response.status} ${JSON.stringify(result.error ?? null)}`,
			result.response.status,
			result.error
		)
	}
	return result.data as T
}

/**
 * Status + body without throwing — for tests that assert on an error response.
 * A 4xx is the expected outcome there, not an exception.
 */
export function toRaw<T>(result: FetchResult<T>): { status: number; body: unknown } {
	return { status: result.response.status, body: result.error ?? result.data ?? null }
}

/** Bearer header in the shape openapi-fetch expects. Auth stays explicit per call. */
export function bearer(token: string): { Authorization: string } {
	return { Authorization: `Bearer ${token}` }
}
